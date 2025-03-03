import asyncpg
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, BotCommand
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters, ContextTypes

# Переменные
TOKEN = '7603140907:AAEHRJo0chFDDycRASXe5ljwtzfMwqe8qA4'
MAIN_ADMIN_ID = '6404101950'  # Ты — главный админ
DB_URL = 'postgresql://neuratest_db_user:M1Ke5EFL1txqlFXL62UOvPdmt6cxurQ8@dpg-cv1ktel6l47c73fg297g-a.oregon-postgres.render.com/neuratest_db'

# Подключение к базе данных
async def get_db_connection():
    return await asyncpg.connect(DB_URL)

# Проверка, есть ли пользователь в админах
async def is_admin(chat_id: str) -> bool:
    conn = await get_db_connection()
    admin = await conn.fetchrow("SELECT * FROM admins WHERE chat_id = $1", chat_id)
    await conn.close()
    return admin is not None or chat_id == MAIN_ADMIN_ID

# Установка команд меню внизу
async def set_bot_commands(application: Application):
    commands = [BotCommand("menu", "Открыть главное меню")]
    await application.bot.set_my_commands(commands)

# Команда /start
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = str(update.message.chat_id)
    if not await is_admin(chat_id):
        await update.message.reply_text("🚫 Доступ запрещён!")
        return
    await show_main_menu(update.message.chat_id, context)

# Команда /menu
async def menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = str(update.message.chat_id)
    if not await is_admin(chat_id):
        await update.message.reply_text("🚫 Доступ запрещён!")
        return
    await show_main_menu(chat_id, context)

# Показать главное меню
async def show_main_menu(chat_id: str, context: ContextTypes.DEFAULT_TYPE) -> None:
    keyboard = [
        [InlineKeyboardButton("📋 Work", callback_data='work_menu')],
        [InlineKeyboardButton("⚙️ Управление ботом", callback_data='admin_menu')]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await context.bot.send_message(chat_id=chat_id, text="👋 Выберите раздел:", reply_markup=reply_markup)

# Меню Work
async def work_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    chat_id = str(query.message.chat_id)
    if not await is_admin(chat_id):
        await query.message.reply_text("🚫 Доступ запрещён!")
        return

    keyboard = [
        [InlineKeyboardButton("📋 Список пользователей", callback_data='list_users')],
        [InlineKeyboardButton("✏️ Изменить данные", callback_data='update_user')],
        [InlineKeyboardButton("📊 Данные ЛК", callback_data='dashboard_data')]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.message.edit_text("📋 Раздел Work:", reply_markup=reply_markup)
    await query.answer()

# Меню Управление ботом
async def admin_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    chat_id = str(query.message.chat_id)
    if not await is_admin(chat_id):
        await query.message.reply_text("🚫 Доступ запрещён!")
        return

    keyboard = [
        [InlineKeyboardButton("➕ Добавить права", callback_data='add_admin')],
        [InlineKeyboardButton("➖ Удалить права", callback_data='remove_admin')]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.message.edit_text("⚙️ Управление ботом:", reply_markup=reply_markup)
    await query.answer()

# Вывод списка пользователей
async def list_users(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    chat_id = str(query.message.chat_id)
    if not await is_admin(chat_id):
        await query.message.reply_text("🚫 Доступ запрещён!")
        return

    conn = await get_db_connection()
    users = await conn.fetch("SELECT * FROM users")
    await conn.close()

    print(f"🔍 Найдено пользователей: {len(users)}")

    if not users:
        await query.message.reply_text("📂 В базе нет пользователей.")
        return

    for user in users:
        msg = (
            f"👤 Пользователь: {user['login']}\n"
            f"🔑 Пароль: {user['password']}\n"
            f"💰 Баланс: {user['balance']} USD\n"
            f"📋 Завершено задач: {user['taskscompleted']}\n"
            f"💸 Заработано сегодня: {user['earnedtoday']} USD\n"
            f"🏆 Всего заработано: {user['earnedtotal']} USD\n"
            f"👛 Кошелёк: {user['wallet'] or 'Не привязан'}\n"
            f"🔐 Seed-фразы: {', '.join(user['seeds']) or 'Не привязаны'}"
        )
        await query.message.reply_text(msg)
    await query.answer()

# Выбор пользователя для изменения данных
async def update_user(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    chat_id = str(query.message.chat_id)
    if not await is_admin(chat_id):
        await query.message.reply_text("🚫 Доступ запрещён!")
        return

    conn = await get_db_connection()
    users = await conn.fetch("SELECT login FROM users")
    await conn.close()

    if not users:
        await query.message.reply_text("📂 В базе нет пользователей.")
        return

    keyboard = [[InlineKeyboardButton(user['login'], callback_data=f"select_user_{user['login']}")] for user in users]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.message.reply_text("Выберите пользователя:", reply_markup=reply_markup)
    await query.answer()

# Выбор поля для изменения или удаления
async def select_user(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    chat_id = str(query.message.chat_id)
    if not await is_admin(chat_id):
        await query.message.reply_text("🚫 Доступ запрещён!")
        return

    login = query.data.replace('select_user_', '')
    context.user_data['login'] = login

    keyboard = [
        [InlineKeyboardButton("Баланс", callback_data=f"edit_{login}_balance")],
        [InlineKeyboardButton("Завершено задач", callback_data=f"edit_{login}_taskscompleted")],
        [InlineKeyboardButton("Заработано сегодня", callback_data=f"edit_{login}_earnedtoday")],
        [InlineKeyboardButton("Всего заработано", callback_data=f"edit_{login}_earnedtotal")],
        [InlineKeyboardButton("Кошелёк", callback_data=f"edit_{login}_wallet")],
        [InlineKeyboardButton("Seed-фразы", callback_data=f"edit_{login}_seeds")],
        [InlineKeyboardButton("🗑️ Удалить пользователя", callback_data=f"delete_user_{login}")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.message.reply_text(f"Выберите, что изменить для {login} или удалить его:", reply_markup=reply_markup)
    await query.answer()

# Ввод нового значения
async def edit_field(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    chat_id = str(query.message.chat_id)
    if not await is_admin(chat_id):
        await query.message.reply_text("🚫 Доступ запрещён!")
        return

    parts = query.data.split('_')
    login = parts[1]
    field = parts[2]
    context.user_data['field'] = field
    await query.message.reply_text(f"Введите новое значение для {field} пользователя {login}:")
    await query.answer()

# Удаление пользователя
async def delete_user(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    chat_id = str(query.message.chat_id)
    if not await is_admin(chat_id):
        await query.message.reply_text("🚫 Доступ запрещён!")
        return

    login = query.data.replace('delete_user_', '')
    conn = await get_db_connection()
    try:
        await conn.execute("DELETE FROM users WHERE login = $1", login)
        await query.message.reply_text(f"✅ Пользователь {login} удалён!")
        message = f"Пользователь {login} был удалён из базы данных."
        await context.bot.send_message(chat_id=MAIN_ADMIN_ID, text=message)
    except Exception as e:
        await query.message.reply_text(f"⚠️ Ошибка при удалении: {str(e)}")
    finally:
        await conn.close()
    await query.answer()

# Выбор способа просмотра данных ЛК
async def dashboard_data(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    chat_id = str(query.message.chat_id)
    if not await is_admin(chat_id):
        await query.message.reply_text("🚫 Доступ запрещён!")
        return

    keyboard = [
        [InlineKeyboardButton("🔍 Поиск по логину", callback_data='search_by_login')],
        [InlineKeyboardButton("📋 Весь список", callback_data='show_all_users')]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.message.edit_text("📊 Как просмотреть данные ЛК?", reply_markup=reply_markup)
    await query.answer()

# Поиск по логину
async def search_by_login(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    chat_id = str(query.message.chat_id)
    if not await is_admin(chat_id):
        await query.message.reply_text("🚫 Доступ запрещён!")
        return

    await query.message.reply_text("Введите логин пользователя для поиска:")
    context.user_data['action'] = 'search_login'
    await query.answer()

# Показать весь список пользователей
async def show_all_users(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    chat_id = str(query.message.chat_id)
    if not await is_admin(chat_id):
        await query.message.reply_text("🚫 Доступ запрещён!")
        return

    conn = await get_db_connection()
    users = await conn.fetch("SELECT login FROM users")
    await conn.close()

    if not users:
        await query.message.reply_text("📂 В базе нет пользователей.")
        return

    keyboard = [[InlineKeyboardButton(user['login'], callback_data=f"show_dashboard_{user['login']}")] for user in users]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.message.reply_text("📋 Выберите пользователя для просмотра данных ЛК:", reply_markup=reply_markup)
    await query.answer()

# Показать данные ЛК конкретного пользователя
async def show_dashboard(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    chat_id = str(query.message.chat_id)
    if not await is_admin(chat_id):
        await query.message.reply_text("🚫 Доступ запрещён!")
        return

    login = query.data.replace('show_dashboard_', '')
    conn = await get_db_connection()
    user = await conn.fetchrow("SELECT * FROM users WHERE login = $1", login)
    await conn.close()

    if not user:
        await query.message.reply_text("⚠️ Пользователь не найден!")
        return

    msg = (
        f"📊 Данные ЛК пользователя {user['login']}:\n"
        f"💰 Баланс: {user['balance']} USD\n"
        f"📋 Завершено задач: {user['taskscompleted']}\n"
        f"💸 Заработано сегодня: {user['earnedtoday']} USD\n"
        f"🏆 Всего заработано: {user['earnedtotal']} USD\n"
        f"👛 Кошелёк: {user['wallet'] or 'Не привязан'}\n"
        f"🔐 Seed-фразы: {', '.join(user['seeds']) or 'Не привязаны'}"
    )
    await query.message.reply_text(msg)
    await query.answer()

# Добавление нового админа
async def add_admin(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    chat_id = str(query.message.chat_id)
    if chat_id != MAIN_ADMIN_ID:  # Только главный админ может добавлять права
        await query.message.reply_text("🚫 Только главный админ может добавлять права!")
        return

    await query.message.reply_text("Введите Telegram ID пользователя, которому дать права (например, 123456789):")
    context.user_data['action'] = 'add_admin'
    await query.answer()

# Удаление админа
async def remove_admin(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    chat_id = str(query.message.chat_id)
    if chat_id != MAIN_ADMIN_ID:  # Только главный админ может удалять права
        await query.message.reply_text("🚫 Только главный админ может удалять права!")
        return

    conn = await get_db_connection()
    admins = await conn.fetch("SELECT chat_id FROM admins WHERE chat_id != $1", MAIN_ADMIN_ID)
    await conn.close()

    if not admins:
        await query.message.reply_text("📂 Нет дополнительных админов.")
        return

    keyboard = [[InlineKeyboardButton(str(admin['chat_id']), callback_data=f"remove_admin_{admin['chat_id']}")] for admin in admins]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.message.reply_text("Выберите ID админа для удаления:", reply_markup=reply_markup)
    await query.answer()

# Подтверждение удаления админа
async def confirm_remove_admin(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    chat_id = str(query.message.chat_id)
    if chat_id != MAIN_ADMIN_ID:
        await query.message.reply_text("🚫 Только главный админ может удалять права!")
        return

    admin_id = query.data.replace('remove_admin_', '')
    conn = await get_db_connection()
    await conn.execute("DELETE FROM admins WHERE chat_id = $1", admin_id)
    await conn.close()

    await query.message.reply_text(f"✅ Права для {admin_id} удалены!")
    await query.answer()

# Обработка ввода сообщения
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = str(update.message.chat_id)
    if not await is_admin(chat_id):
        await update.message.reply_text("🚫 Доступ запрещён!")
        return

    # Обработка изменения данных пользователя
    if 'field' in context.user_data and 'login' in context.user_data:
        login = context.user_data['login']
        field = context.user_data['field']
        value = update.message.text

        conn = await get_db_connection()
        try:
            if field == 'seeds':
                seeds = value.split(',')
                await conn.execute(f"UPDATE users SET {field} = $1 WHERE login = $2", seeds, login)
            elif field in ['balance', 'taskscompleted', 'earnedtoday', 'earnedtotal']:
                await conn.execute(f"UPDATE users SET {field} = $1 WHERE login = $2", float(value) if field != 'taskscompleted' else int(value), login)
            else:
                await conn.execute(f"UPDATE users SET {field} = $1 WHERE login = $2", value, login)

            await update.message.reply_text(f"✅ Обновлено {field} для {login} на {value}")
            message = f"Пользователь обновил данные:\nЛогин: {login}\nПоле: {field}\nНовое значение: {value}"
            await context.bot.send_message(chat_id=MAIN_ADMIN_ID, text=message)
        except Exception as e:
            await update.message.reply_text(f"⚠️ Ошибка: {str(e)}")
        finally:
            await conn.close()
            del context.user_data['field']

    # Обработка добавления админа
    elif 'action' in context.user_data and context.user_data['action'] == 'add_admin' and chat_id == MAIN_ADMIN_ID:
        new_admin_id = update.message.text.strip()
        conn = await get_db_connection()
        try:
            existing_admin = await conn.fetchrow("SELECT * FROM admins WHERE chat_id = $1", new_admin_id)
            if existing_admin or new_admin_id == MAIN_ADMIN_ID:
                await update.message.reply_text(f"⚠️ Пользователь {new_admin_id} уже админ!")
            else:
                await conn.execute("INSERT INTO admins (chat_id) VALUES ($1)", new_admin_id)
                await update.message.reply_text(f"✅ Права выданы пользователю {new_admin_id}!")
                await context.bot.send_message(chat_id=new_admin_id, text="🎉 Вам выданы права админа в боте!")
        except Exception as e:
            await update.message.reply_text(f"⚠️ Ошибка: {str(e)}")
        finally:
            await conn.close()
            del context.user_data['action']

    # Обработка поиска по логину
    elif 'action' in context.user_data and context.user_data['action'] == 'search_login':
        login = update.message.text.strip()
        conn = await get_db_connection()
        user = await conn.fetchrow("SELECT login FROM users WHERE login = $1", login)
        await conn.close()

        if not user:
            await update.message.reply_text(f"⚠️ Пользователь {login} не найден!")
        else:
            keyboard = [[InlineKeyboardButton(user['login'], callback_data=f"show_dashboard_{user['login']}")]]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await update.message.reply_text(f"🔍 Найден пользователь:", reply_markup=reply_markup)
        del context.user_data['action']

# Запуск бота
def main() -> None:
    application = Application.builder().token(TOKEN).build()

    # Регистрация обработчиков
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("menu", menu))
    application.add_handler(CallbackQueryHandler(work_menu, pattern='^work_menu$'))
    application.add_handler(CallbackQueryHandler(admin_menu, pattern='^admin_menu$'))
    application.add_handler(CallbackQueryHandler(list_users, pattern='^list_users$'))
    application.add_handler(CallbackQueryHandler(update_user, pattern='^update_user$'))
    application.add_handler(CallbackQueryHandler(select_user, pattern='^select_user_'))
    application.add_handler(CallbackQueryHandler(edit_field, pattern='^edit_'))
    application.add_handler(CallbackQueryHandler(delete_user, pattern='^delete_user_'))
    application.add_handler(CallbackQueryHandler(dashboard_data, pattern='^dashboard_data$'))
    application.add_handler(CallbackQueryHandler(search_by_login, pattern='^search_by_login$'))
    application.add_handler(CallbackQueryHandler(show_all_users, pattern='^show_all_users$'))
    application.add_handler(CallbackQueryHandler(show_dashboard, pattern='^show_dashboard_'))
    application.add_handler(CallbackQueryHandler(add_admin, pattern='^add_admin$'))
    application.add_handler(CallbackQueryHandler(remove_admin, pattern='^remove_admin$'))
    application.add_handler(CallbackQueryHandler(confirm_remove_admin, pattern='^remove_admin_'))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    # Установка команд меню
    application.post_init = set_bot_commands

    print("🤖 Бот запущен...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()