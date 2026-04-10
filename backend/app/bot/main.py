"""
Telegram Bot Main Module
Sets up bot commands, menu button, and WebApp integration
"""
import logging
from typing import Optional

from telegram import (
    BotCommand,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    MenuButtonWebApp,
    Update,
    WebAppInfo,
)
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
)

from app.application.analytics_service import AnalyticsService
from app.application.users_service import UsersService
from app.infrastructure.database import AsyncSessionLocal
from app.settings import settings

logger = logging.getLogger(__name__)

# Global bot application instance
_bot_application: Optional[Application] = None


async def _collect_stats_for_telegram_user(telegram_id: int) -> dict | None:
    async with AsyncSessionLocal() as db:
        service = UsersService(db)
        user = await service.get_user_model_by_telegram_id(telegram_id)
        if user is None:
            return None

        analytics = AnalyticsService(db)
        summary = await analytics.get_analytics_summary(user_id=user.id, period="30d")
        return {
            "total_workouts": int(summary.total_workouts or 0),
            "total_duration": int(summary.total_duration or 0),
        }


def _format_stats_text(total_workouts: int, total_duration_minutes: int) -> str:
    hours = total_duration_minutes // 60
    minutes = total_duration_minutes % 60
    duration_label = f"{hours} ч {minutes} мин" if minutes else f"{hours} ч"
    return (
        "📊 **Ваша статистика**\n\n"
        f"🏋️ Всего тренировок: {total_workouts}\n"
        f"⏱️ Время в зале: {duration_label}\n\n"
        "_Откройте приложение для подробной статистики_"
    )


def _build_stats_text(stats: dict | None) -> str:
    if stats is None:
        return (
            "📊 **Ваша статистика**\n\n"
            "Пока недостаточно данных для расчета.\n"
            "Завершите первую тренировку, и статистика появится здесь.\n\n"
            "_Откройте приложение для подробной статистики_"
        )
    return _format_stats_text(
        total_workouts=int(stats.get("total_workouts") or 0),
        total_duration_minutes=int(stats.get("total_duration") or 0),
    )


async def set_webapp_menu_button(bot: Application) -> None:
    """
    Set the bot's menu button to open the WebApp

    This sets the menu button that appears in the chat with the bot.
    When clicked, it opens the WebApp.
    """
    if not settings.TELEGRAM_WEBAPP_URL:
        logger.warning(
            "TELEGRAM_WEBAPP_URL not set, skipping menu button setup")
        return

    try:
        await bot.bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(
                text="🏋️ FitTracker Pro",
                web_app=WebAppInfo(url=settings.TELEGRAM_WEBAPP_URL)
            )
        )
        logger.info(
            f"Menu button set to open WebApp: {settings.TELEGRAM_WEBAPP_URL}")
    except Exception as e:
        logger.error(f"Failed to set menu button: {e}")


async def set_bot_commands(bot: Application) -> None:
    """
    Set bot commands for the command menu
    """
    commands = [
        BotCommand("start", "🚀 Открыть FitTracker Pro"),
        BotCommand("help", "❓ Помощь и инструкции"),
        BotCommand("stats", "📊 Моя статистика"),
        BotCommand("settings", "⚙️ Настройки"),
    ]

    try:
        await bot.bot.set_my_commands(commands)
        logger.info("Bot commands set successfully")
    except Exception as e:
        logger.error(f"Failed to set bot commands: {e}")


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle /start command

    Sends a welcome message with a button to open the WebApp
    """
    user = update.effective_user

    # Create keyboard with WebApp button
    keyboard = [
        [
            InlineKeyboardButton(
                text="🏋️ Открыть FitTracker Pro",
                web_app=WebAppInfo(url=settings.TELEGRAM_WEBAPP_URL)
            )
        ],
        [
            InlineKeyboardButton(
                text="❓ Помощь",
                callback_data="help"
            )
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    welcome_text = (
        f"👋 Привет, {user.first_name}!\n\n"
        "🏋️ **FitTracker Pro** — твой умный помощник для тренировок!\n\n"
        "✨ Возможности:\n"
        "• 📝 Планирование тренировок\n"
        "• 📊 Отслеживание прогресса\n"
        "• 🏆 Достижения и награды\n"
        "• ❤️ Мониторинг здоровья\n"
        "• 📈 Аналитика результатов\n\n"
        "Нажми кнопку ниже, чтобы начать!"
    )

    await update.message.reply_text(
        welcome_text,
        reply_markup=reply_markup,
        parse_mode="Markdown"
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle /help command
    """
    help_text = (
        "📖 **Справка по FitTracker Pro**\n\n"
        "🏋️ **Тренировки:**\n"
        "• Создавайте программы тренировок\n"
        "• Выбирайте упражнения из каталога\n"
        "• Отслеживайте подходы и повторения\n\n"
        "📊 **Статистика:**\n"
        "• Просматривайте историю тренировок\n"
        "• Анализируйте прогресс\n"
        "• Получайте рекомендации\n\n"
        "🏆 **Достижения:**\n"
        "• Разблокируйте награды\n"
        "• Соревнуйтесь с друзьями\n\n"
        "❤️ **Здоровье:**\n"
        "• Логируйте показатели\n"
        "• Отслеживайте самочувствие\n\n"
        "📱 **Команды бота:**\n"
        "/start - Открыть приложение\n"
        "/help - Эта справка\n"
        "/stats - Ваша статистика\n"
        "/settings - Настройки"
    )

    await update.message.reply_text(
        help_text,
        parse_mode="Markdown"
    )


async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle /stats command
    """
    telegram_id = getattr(update.effective_user, "id", None)
    stats = None
    if isinstance(telegram_id, int) and telegram_id > 0:
        try:
            stats = await _collect_stats_for_telegram_user(telegram_id)
        except Exception as exc:
            logger.warning("Failed to collect /stats data for telegram_id=%s: %s", telegram_id, exc)

    stats_text = _build_stats_text(stats)

    keyboard = [
        [
            InlineKeyboardButton(
                text="📈 Подробнее в приложении",
                web_app=WebAppInfo(url=settings.TELEGRAM_WEBAPP_URL)
            )
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        stats_text,
        reply_markup=reply_markup,
        parse_mode="Markdown"
    )


async def settings_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle /settings command
    """
    settings_text = (
        "⚙️ **Настройки**\n\n"
        "Откройте приложение для изменения настроек:\n"
        "• Тема оформления\n"
        "• Уведомления\n"
        "• Единицы измерения\n"
        "• Профиль"
    )

    keyboard = [
        [
            InlineKeyboardButton(
                text="⚙️ Открыть настройки",
                web_app=WebAppInfo(
                    url=f"{settings.TELEGRAM_WEBAPP_URL}/profile")
            )
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        settings_text,
        reply_markup=reply_markup,
        parse_mode="Markdown"
    )


async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle inline button callbacks
    """
    query = update.callback_query
    await query.answer()

    if query.data == "help":
        await help_command(update, context)


def setup_bot() -> Application:
    """
    Create and configure the bot application

    Returns:
        Configured Application instance
    """
    global _bot_application

    if not settings.TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN not set, bot will not start")
        return None

    # Create application
    application = Application.builder().token(settings.TELEGRAM_BOT_TOKEN).build()

    # Add handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("stats", stats_command))
    application.add_handler(CommandHandler("settings", settings_command))

    _bot_application = application
    logger.info("Bot application configured")

    return application


async def start_bot(application: Application = None) -> None:
    """
    Start the bot

    Args:
        application: Bot application instance (uses global if not provided)
    """
    app = application or _bot_application

    if not app:
        logger.error("Bot application not configured, call setup_bot() first")
        return

    try:
        # Initialize the application
        await app.initialize()

        # Set menu button and commands
        await set_webapp_menu_button(app)
        await set_bot_commands(app)

        # Start polling
        await app.start()
        await app.updater.start_polling()

        logger.info("Telegram bot started successfully")

    except Exception as e:
        logger.error(f"Failed to start bot: {e}")


async def stop_bot(application: Application = None) -> None:
    """
    Stop the bot

    Args:
        application: Bot application instance (uses global if not provided)
    """
    app = application or _bot_application

    if not app:
        return

    try:
        await app.updater.stop()
        await app.stop()
        await app.shutdown()
        logger.info("Telegram bot stopped")
    except Exception as e:
        logger.error(f"Error stopping bot: {e}")


def run_bot_sync() -> None:
    """
    Run the bot synchronously (for running in a separate thread)
    """
    application = setup_bot()
    if application:
        application.run_polling(allowed_updates=Update.ALL_TYPES)


async def start_bot_webhook(
    application: Application = None,
    webhook_url: str = None,
    webhook_path: str = "/telegram/webhook"
) -> None:
    """
    Start the bot in webhook mode (production)

    Args:
        application: Bot application instance (uses global if not provided)
        webhook_url: Full URL for webhook (e.g., https://example.com/telegram/webhook)
        webhook_path: Path for webhook endpoint
    """
    app = application or _bot_application

    if not app:
        logger.error("Bot application not configured, call setup_bot() first")
        return

    webhook_url = webhook_url or f"{settings.TELEGRAM_WEBAPP_URL}{webhook_path}"

    try:
        # Initialize the application
        await app.initialize()

        # Set menu button and commands
        await set_webapp_menu_button(app)
        await set_bot_commands(app)

        # Set webhook
        await app.bot.set_webhook(url=webhook_url)
        logger.info(f"Webhook set to: {webhook_url}")

        # Start application (without updater for webhook mode)
        await app.start()

        logger.info("Telegram bot started successfully (webhook mode)")

    except Exception as e:
        logger.error(f"Failed to start bot in webhook mode: {e}")


async def process_webhook_update(update: dict) -> None:
    """
    Process an update received via webhook

    Args:
        update: Update dict from Telegram
    """
    if _bot_application:
        await _bot_application.process_update(Update.de_json(update, _bot_application.bot))
