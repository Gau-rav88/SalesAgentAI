"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { authService } from "@/services/auth.service";
import { useCurrentUser } from "@/components/auth/auth-guard";

function initials(name: string) {
  return name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

export function ProfileForm() {
  const router = useRouter();
  const user = useCurrentUser();

  function handleLogout() {
    authService.logout();
    router.push("/login");
  }

  return (
    <div className="max-w-lg space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="text-base">
                {user ? initials(user.username) : "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-white/90">{user?.username ?? "—"}</p>
              <p className="text-xs text-white/40">{user?.email ?? ""}</p>
            </div>
          </div>
          <Separator />
          <div className="space-y-1.5">
            <Label htmlFor="fullname">Full name</Label>
            <Input id="fullname" defaultValue={user?.username ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue={user?.email ?? ""} />
          </div>
          <Button size="sm">Save changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <Input id="current-password" type="password" placeholder="••••••••••" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input id="new-password" type="password" placeholder="••••••••••" />
          </div>
          <Button size="sm" variant="secondary">
            Update password
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <p className="text-sm font-medium text-white/85">Sign out</p>
            <p className="text-xs text-white/35">End your current session on this device.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleLogout}>
            <LogOut className="h-3.5 w-3.5" /> Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}