"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Alert, Button, Card, PageHeader, Skeleton } from "@/components/ui";
import { isLoading } from "@/store/asyncState";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchProfile, logout } from "../auth.thunks";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-fg">{value}</p>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 last:border-0">
      <span className="text-sm text-fg-muted">{label}</span>
      <span className="text-sm text-fg">{value}</span>
    </div>
  );
}

export function ProfileView() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { profile, profileRequest, request } = useAppSelector((s) => s.auth);

  useEffect(() => {
    dispatch(fetchProfile());
  }, [dispatch]);

  async function signOut() {
    await dispatch(logout());
    router.replace("/login");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Your account and activity."
        actions={
          <Button variant="danger" loading={isLoading(request)} onClick={signOut}>
            Sign out
          </Button>
        }
      />

      {profileRequest.error && <Alert title="Couldn't load your profile">{profileRequest.error}</Alert>}

      {isLoading(profileRequest) && !profile && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-[86px]" />
            <Skeleton className="h-[86px]" />
          </div>
          <Skeleton className="h-32" />
        </div>
      )}

      {profile && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Connections" value={profile.connectionCount} />
            <Stat label="Questions asked" value={profile.queryCount} />
          </div>

          <Card>
            <Row label="Email" value={profile.email} />
            <Row label="Member since" value={new Date(profile.createdAt).toLocaleDateString(undefined, { dateStyle: "long" })} />
            <Row label="User ID" value={profile.id} />
          </Card>

          <p className="text-xs text-fg-subtle">
            Connection strings are encrypted at rest and never returned to the browser. DataPilot connects to your
            databases read-only.
          </p>
        </>
      )}
    </div>
  );
}
