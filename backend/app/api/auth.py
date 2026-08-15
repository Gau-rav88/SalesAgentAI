import base64
from datetime import datetime, timezone
import hashlib
import hmac
import secrets
import traceback

from fastapi import APIRouter, Depends, HTTPException
from google.auth.transport import requests
from google.oauth2 import id_token
from google_auth_oauthlib.flow import Flow
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.core.config import settings
from app.database.session import get_db
from app.models.connected_account import ConnectedAccount
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse
from app.services.auth_service import AuthService

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

service = AuthService()


# ============================================================
# Existing Authentication
# ============================================================

@router.post("/register", response_model=UserResponse)
def register(
    user: UserCreate,
    db: Session = Depends(get_db),
):
    try:
        return service.register(db, user)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )


@router.post("/login")
def login(
    user: UserLogin,
    db: Session = Depends(get_db),
):
    try:
        return service.login(db, user)
    except ValueError as e:
        raise HTTPException(
            status_code=401,
            detail=str(e),
        )


@router.get("/me", response_model=UserResponse)
def me(
    current_user: User = Depends(get_current_user),
):
    return current_user


# ============================================================
# Google OAuth Configuration & PKCE Utilities
# ============================================================

GOOGLE_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/gmail.send",
]

# Temporary PKCE storage.
# Fine for local/hackathon development.
# Later we can move this to Redis/database for production.
PKCE_STORE: dict[str, str] = {}


def generate_pkce():
    """
    Generate PKCE code verifier and code challenge.
    """
    code_verifier = secrets.token_urlsafe(64)

    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()

    code_challenge = (
        base64.urlsafe_b64encode(digest)
        .decode("ascii")
        .rstrip("=")
    )

    return code_verifier, code_challenge


def create_oauth_state(user_id: int) -> str:
    user_id_str = str(user_id)

    secret = settings.JWT_SECRET_KEY.encode()

    timestamp = str(int(datetime.now(timezone.utc).timestamp()))

    nonce = secrets.token_urlsafe(32)

    payload = f"{user_id_str}:{timestamp}:{nonce}"

    signature = hmac.new(
        secret,
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()

    return f"{payload}:{signature}"


def verify_oauth_state(state: str) -> int:
    try:
        parts = state.split(":")

        if len(parts) != 4:
            raise HTTPException(
                status_code=400,
                detail="Invalid OAuth state",
            )

        user_id_str, timestamp, nonce, signature = parts

        secret = settings.JWT_SECRET_KEY.encode()

        payload = f"{user_id_str}:{timestamp}:{nonce}"

        expected_signature = hmac.new(
            secret,
            payload.encode(),
            hashlib.sha256,
        ).hexdigest()

        if not secrets.compare_digest(
            signature,
            expected_signature,
        ):
            raise HTTPException(
                status_code=400,
                detail="Invalid OAuth state signature",
            )

        # 10 minute expiry
        created_at = int(timestamp)

        now = int(
            datetime.now(timezone.utc).timestamp()
        )

        if now - created_at > 600:
            raise HTTPException(
                status_code=400,
                detail="OAuth state expired",
            )

        return int(user_id_str)

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid OAuth state",
        )


def create_google_flow(code_verifier: str | None = None):
    client_config = {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
        }
    }

    flow = Flow.from_client_config(
        client_config,
        scopes=GOOGLE_SCOPES,
        code_verifier=code_verifier,
        autogenerate_code_verifier=False,
    )

    flow.redirect_uri = settings.GOOGLE_REDIRECT_URI

    return flow


# ============================================================
# Google Login
# ============================================================

@router.get("/google/login")
def google_login(
    current_user: User = Depends(get_current_user),
):
    """
    Start Google OAuth with PKCE.
    """
    code_verifier, code_challenge = generate_pkce()

    flow = create_google_flow(
        code_verifier=code_verifier
    )

    state = create_oauth_state(current_user.id)

    PKCE_STORE[state] = code_verifier

    authorization_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state,
        code_challenge=code_challenge,
        code_challenge_method="S256",
    )

    return {
        "authorization_url": authorization_url,
        "state": state,
    }


# ============================================================
# Google Callback
# ============================================================

@router.get("/google/callback")
def google_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db),
):
    """
    Google OAuth callback with PKCE verification.
    """
    try:
        # --------------------------------------------------
        # 1. Verify OAuth state
        # --------------------------------------------------
        prospectiq_user_id = verify_oauth_state(state)

        # --------------------------------------------------
        # 2. Get original PKCE verifier
        # --------------------------------------------------
        code_verifier = PKCE_STORE.pop(state, None)

        if not code_verifier:
            raise HTTPException(
                status_code=400,
                detail=(
                    "PKCE code verifier not found. "
                    "Please restart Google connection."
                ),
            )

        # --------------------------------------------------
        # 3. Verify ProspectIQ user
        # --------------------------------------------------
        user = (
            db.query(User)
            .filter(User.id == prospectiq_user_id)
            .first()
        )

        if not user:
            raise HTTPException(
                status_code=404,
                detail="ProspectIQ user not found",
            )

        # --------------------------------------------------
        # 4. Create Google OAuth flow
        # --------------------------------------------------
        flow = create_google_flow(
            code_verifier=code_verifier
        )

        # --------------------------------------------------
        # 5. Exchange authorization code
        # --------------------------------------------------
        flow.fetch_token(
            code=code,
        )

        credentials = flow.credentials

        # --------------------------------------------------
        # 6. Extract email from Google ID token
        # --------------------------------------------------
        request = requests.Request()
        id_info = id_token.verify_oauth2_token(
            credentials.id_token,
            request,
            settings.GOOGLE_CLIENT_ID,
        )
        google_email = id_info["email"]

        # --------------------------------------------------
        # 7. Find existing connection
        # --------------------------------------------------
        account = (
            db.query(ConnectedAccount)
            .filter(
                ConnectedAccount.user_id == prospectiq_user_id,
                ConnectedAccount.provider == "google",
            )
            .first()
        )

        # --------------------------------------------------
        # 8. Update existing Gmail connection
        # --------------------------------------------------
        if account:
            account.email = google_email
            account.access_token = credentials.token

            if credentials.refresh_token:
                account.refresh_token = credentials.refresh_token

            account.token_expiry = credentials.expiry
            account.updated_at = datetime.now(timezone.utc)

        # --------------------------------------------------
        # 9. Create new Gmail connection
        # --------------------------------------------------
        else:
            if not credentials.refresh_token:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Google did not return a refresh token. "
                        "Please revoke the existing Google permission "
                        "and connect again."
                    ),
                )

            account = ConnectedAccount(
                user_id=prospectiq_user_id,
                provider="google",
                email=google_email,
                access_token=credentials.token,
                refresh_token=credentials.refresh_token,
                token_expiry=credentials.expiry,
            )

            db.add(account)

        db.commit()
        db.refresh(account)

        # --------------------------------------------------
        # 10. Success
        # --------------------------------------------------
        return {
            "success": True,
            "message": "Gmail connected successfully",
            "email": google_email,
            "user_id": prospectiq_user_id,
        }

    except HTTPException:
        raise

    except Exception as e:

        db.rollback()

        print("\n\n========== GOOGLE OAUTH ERROR ==========")
        traceback.print_exc()
        print("========================================\n\n")

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )


# ============================================================
# Gmail Status
# ============================================================

@router.get("/google/status")
def google_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account = (
        db.query(ConnectedAccount)
        .filter(
            ConnectedAccount.user_id == current_user.id,
            ConnectedAccount.provider == "google",
        )
        .first()
    )

    if not account:
        return {
            "connected": False,
            "email": None,
        }

    return {
        "connected": True,
        "email": account.email,
    }