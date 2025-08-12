import { components } from "../_generated/api";
import { Resend } from "@convex-dev/resend";
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const resend: Resend = new Resend(components.resend, {
    testMode: false,
});

export const sendEmail = internalMutation({
  args: {
    from: v.string(),
    to: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const email = await resend.sendEmail(ctx, {
        from: args.from,
        to: args.to,
        subject: args.subject,
        html: args.body,
    });

    return email;
  },
});
