"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Shell from "@/components/shell";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const [data, setData] = useState<{ unread: number; notifications: Notification[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ unread: number; notifications: Notification[] }>("/notifications")
      .then(setData)
      .catch(() => setError("Could not load notifications."));
  }, []);

  if (data === null) {
    return (
      <Shell role="doctor">
        {error ? (
          <Card className="mb-6">
            <p className="p-4 text-sm text-danger">{error}</p>
            <Button onClick={() => window.location.reload()} size="sm">
              Retry
            </Button>
          </Card>
        ) : (
          <div className="flex h-full items-center justify-center p-8">
            <div className="h-8 w-8 rounded border-border" />
          </div>
        )}
      </Shell>
    );
  }

  return (
    <Shell role="doctor">
      <div className="max-w-3xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink mb-2">Notifications</h1>
            <p className="text-sm text-ink-secondary">Your notifications</p>
          </div>
          <Button onClick={handleReadAll} disabled={data?.notifications.every((n) => n.read)}>
            Mark all read
          </Button>
        </div>

        {error && (
          <Card className="mb-6">
            <p className="p-4 text-sm text-danger">{error}</p>
            <Button onClick={() => window.location.reload()} size="sm">
              Retry
            </Button>
          </Card>
        )}

        {data.notifications.length === 0 && (
          <Card className="mb-6">
            <p className="p-8 text-center text-ink-secondary">No notifications.</p>
          </Card>
        )}

        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {data.notifications.map((n) => (
              <li key={n.id} className={`px-6 py-4 ${!n.read ? "bg-accent/5" : ""} tap-interactive hover:bg-bg-elevated transition-colors`} onClick={() => handleRead(n.id)}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className={`font-medium text-ink ${!n.read ? "font-bold" : ""}`}>{n.title}</p>
                    <p className="text-sm text-ink-secondary">{n.body}</p>
                    <p className="text-xs text-ink-secondary mt-1">{new Date(n.created_at).toLocaleString("en-GB")}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-accent" />}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </Shell>
  );

  function handleRead(id: number) {
    api(`/notifications/${id}/read`, { method: "POST" }).then(() => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          unread: prev.unread - 1,
          notifications: prev.notifications.map((nn) => (nn.id === id ? { ...nn, read: true } : nn)),
        };
      });
    });
  }

  function handleReadAll() {
    api("/notifications/read-all", { method: "POST" }).then(() => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          unread: 0,
          notifications: prev.notifications.map((nn) => ({ ...nn, read: true })),
        };
      });
    });
  }
}

