export interface Env {}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const data = await context.request.json() as {
      email: string;
      organization: string;
      workflow: string;
      priority: string;
    };

    // Validate required fields
    if (!data.email || !data.organization || !data.workflow) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build the email content
    const subject = `[Stria Systems] Demo Request from ${data.organization}`;
    const body = `New demo request submitted:

Organization: ${data.organization}
Contact: ${data.email}
Workflow: ${data.workflow}
Priority: ${data.priority}

Submitted at: ${new Date().toISOString()}
`;

    // Send email using a third-party service from within the Worker
    // Using a simple HTTP POST to an email endpoint
    const emailPayload = {
      to: "cnazarko@icloud.com",
      from: "demo@striasystems.com",
      subject: subject,
      text: body,
    };

    // For now, log the request. To enable actual email delivery,
    // set a RESEND_API_KEY or FORMSPREE_KEY secret via:
    //   wrangler pages secret put RESEND_API_KEY
    //
    // Then uncomment the fetch block below.

    console.log("Demo request received:", emailPayload);

    /*
    // Example with Resend (free tier: 100 emails/day)
    // Uncomment after setting RESEND_API_KEY secret
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${context.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!resendResponse.ok) {
      console.error("Email send failed:", await resendResponse.text());
      return new Response(
        JSON.stringify({ error: "Failed to send email" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    */

    // Also send via Formspree as a fallback (requires FORMSPREE_ID secret)
    // Uncomment after setting FORMSPREE_ID
    /*
    await fetch(`https://formspree.io/f/${context.env.FORMSPREE_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: data.email,
        organization: data.organization,
        workflow: data.workflow,
        priority: data.priority,
        _replyto: data.email,
      }),
    });
    */

    return new Response(
      JSON.stringify({ success: true, message: "Demo request received" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Demo request error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

// Also handle OPTIONS for CORS preflight
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};
