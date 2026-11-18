"""Send authentication messages through the configured submission server."""
import asyncio
import smtplib
import ssl
from email.message import EmailMessage

from app.settings import settings


def _deliver(recipient: str, code: str) -> None:
    message = EmailMessage()
    message["From"] = settings.AUTH_SMTP_FROM
    message["To"] = recipient
    message["Subject"] = "Код входа FitTracker Pro"
    message.set_content(
        f"Код подтверждения: {code}\n\n"
        "Код действует 10 минут. Если вы его не запрашивали, проигнорируйте это письмо."
    )
    with smtplib.SMTP(settings.AUTH_SMTP_HOST, settings.AUTH_SMTP_PORT, timeout=8) as smtp:
        smtp.starttls(context=ssl.create_default_context())
        if settings.AUTH_SMTP_USERNAME:
            smtp.login(settings.AUTH_SMTP_USERNAME, settings.AUTH_SMTP_PASSWORD)
        smtp.send_message(message)


async def deliver_email_code(recipient: str, code: str) -> None:
    await asyncio.to_thread(_deliver, recipient, code)
