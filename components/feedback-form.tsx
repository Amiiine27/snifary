"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { submitFeedbackAction } from "@/lib/actions/feedback";

const MIN_LENGTH = 20;

export function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      await submitFeedbackAction(message);
      setMessage("");
      toast.success("Merci pour ton retour !");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="On t'ecoute..."
        rows={6}
      />
      <p className="text-xs text-muted-foreground">{message.trim().length}/{MIN_LENGTH} caracteres minimum</p>
      <Button onClick={handleSubmit} disabled={pending || message.trim().length < MIN_LENGTH}>
        Envoyer
      </Button>
    </div>
  );
}
