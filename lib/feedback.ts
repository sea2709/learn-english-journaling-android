import { supabase } from "./supabase";
import type { FeedbackCategory, UserFeedbackSubmission } from "./types";

export const ALL_FEEDBACK_CATEGORIES: FeedbackCategory[] = [
  "bug",
  "idea",
  "other",
];

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: "Bug",
  idea: "Idea",
  other: "Other",
};

export async function submitFeedback(
  payload: UserFeedbackSubmission
): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("You must be signed in to send feedback.");
  if (!user.email) {
    throw new Error("Account email is required to send feedback.");
  }

  const message = payload.message.trim();
  const contactNote = payload.contactNote?.trim();

  if (!message) throw new Error("Message is required.");
  if (message.length > 2000) {
    throw new Error("Message must be 2000 characters or fewer.");
  }
  if (contactNote && contactNote.length > 300) {
    throw new Error("Contact note must be 300 characters or fewer.");
  }

  const { error } = await supabase.from("user_feedback").insert({
    user_id: user.id,
    user_email: user.email,
    category: payload.category,
    message,
    contact_note: contactNote || null,
    status: "new",
  });

  if (error) throw error;
}
