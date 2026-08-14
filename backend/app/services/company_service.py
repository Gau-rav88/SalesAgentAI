from sqlalchemy.orm import Session

from app.models.company import Company


class CompanyService:

    def get_or_create(
        self,
        db: Session,
        name: str,
        website: str = "",
        industry: str = "",
    ) -> Company:

        company = (
            db.query(Company)
            .filter(
                Company.name == name
            )
            .first()
        )

        if company:
            return company

        company = Company(
            name=name,
            website=website,
            industry=industry,
        )

        db.add(company)
        db.commit()
        db.refresh(company)

        return company