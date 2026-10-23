import logging
import os
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import psycopg2
from psycopg2.extras import RealDictCursor
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, ContextTypes, ConversationHandler, filters

# Render Free Web Service အတွက် Fake Server
class SimpleHTTPRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"AKL Gaming Hub Bot is running live with Supabase!")

def run_dummy_server():
    port = int(os.environ.get("PORT", 8080))
    server = HTTPServer(("0.0.0.0", port), SimpleHTTPRequestHandler)
    server.serve_forever()

# Logging သတ်မှတ်ခြင်း
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# ---------------- CONFIGURATION ----------------
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "8840218731:AAExjF4reevpsWZ7yKPcL5QKYRxfApQW980")
ADSTERRA_DIRECT_LINK = "https://araplhn.org/4/a5cf2ac42fc3b28070b87afb456402e7"
ADMIN_ID = 7122952141

# Supabase Database URL (Transaction Pooler - IPv4 Compatible)
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres.ncjrzuhpdiwrjveogpmt:aungkhainglin12@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres")

WELCOME_IMAGE = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhCrFvWn7BeKrQtNho2cu_CqR-X0f8BuptBTTIt4fzBbAc-rGTu_dQ1pQLUkMGmsRboaG49JqB4jqQXzUJ-W2obNGmN-EwGVcwFMLQnpSO_ZvLNGhTinvQkc1SWOmFmD-ZgelySMmNMqx0qE3UeYIG6OSt06Xd1gu7Hbpc2lPnXm3jw5_9a0E4W_VNYnj0/s736/45709.jpg"

# Conversation States for Adding Game
GET_NAME, GET_PHOTO, GET_APK_CHOICE, GET_APK_CONTENT, GET_OBB_CHOICE, GET_OBB_CONTENT = range(6)

# Database Connection Helper Function
def get_db_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

# Supabase မှ ဂိမ်းအချက်အလက်များ အားလုံး ဖတ်ယူရန်
def load_db():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM games;")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        db = {}
        for row in rows:
            db[row['key']] = {
                "name": row['name'],
                "image": row['image'],
                "apk_type": row.get('apk_type'),
                "apk_value": row.get('apk_value'),
                "obb_type": row.get('obb_type'),
                "obb_value": row.get('obb_value')
            }
        return db
    except Exception as e:
        print(f"Database Load Error: {e}")
        return {}

# ---------------- HANDLERS ----------------

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    args = context.args
    db = load_db()
    
    if not args:
        welcome_text = (
            f"🔥 **မင်္ဂလာပါ {user.first_name}!** 🔥\n\n"
            "🎮 **AKL Gaming Hub File Bot မှ ကြိုဆိုပါတယ်!**\n\n"
            "🔍 **ဂိမ်းများ ရှာဖွေလိုပါက အောက်ပါအတိုင်း ရိုက်ရှာနိုင်ပါတယ် -**\n"
            "👉 `/search ဂိမ်းနာမည်`"
        )
        try:
            await update.message.reply_photo(photo=WELCOME_IMAGE, caption=welcome_text, parse_mode="Markdown")
        except Exception:
            await update.message.reply_text(text=welcome_text, parse_mode="Markdown")
        return

    game_key = args[0]
    if game_key not in db:
        await update.message.reply_text("⚠️ ဒီဂိမ်း မရှိသေးပါ။ မကြာမီ တင်ပေးပါမည်။")
        return
        
    game_info = db[game_key]
    game_name = game_info["name"]
    game_image = game_info["image"]
    
    context.user_data['unlocked'] = False
    context.user_data['game_key'] = game_key
    
    game_text = (
        f"🔥 **Hey {user.first_name}!** 🔥\n\n"
        f"🎮 **ဂိမ်းအမည်:** {game_name}\n\n"
        "⚡ **ဂိမ်းဖိုင် ရယူရန် အဆင့်များ:**\n"
        "၁။ အောက်ပါ **'🔓 Unlock Download Link (Ad)'** ကို တစ်ချက်နှိပ်ပြီး ကြော်ငြာကြည့်ပေးပါ။\n"
        "၂။ ပြီးလျှင် အဲ့ထဲ ပြန်ထွက်လာပြီး **'📥 Download Links ရယူရန်'** ကို နှိပ်ပါ!"
    )
    
    keyboard = [
        [InlineKeyboardButton("🔓 Unlock Download Link (Ad)", url=ADSTERRA_DIRECT_LINK)],
        [InlineKeyboardButton("📥 Download Links ရယူရန်", callback_data=f"get_files_{game_key}")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    try:
        if game_image:
            await update.message.reply_photo(photo=game_image, caption=game_text, reply_markup=reply_markup, parse_mode="Markdown")
        else:
            raise Exception()
    except Exception:
        await update.message.reply_text(text=game_text, reply_markup=reply_markup, parse_mode="Markdown")

async def search_game(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not context.args:
        await update.message.reply_text("⚠️ ရှာချင်တဲ့ ဂိမ်းနာမည် ရိုက်ထည့်ပေးပါခင်ဗျာ။ ဥပမာ- `/search simulator`", parse_mode="Markdown")
        return

    query = " ".join(context.args).lower()
    db = load_db()
    results = []

    for key, data in db.items():
        if query in data["name"].lower() or query in key.lower():
            results.append((key, data["name"]))

    if not results:
        await update.message.reply_text(f"⚠️ `{query}` နာမည်နဲ့ ပတ်သက်တဲ့ ဂိမ်း ရှာမတွေ့ပါ။", parse_mode="Markdown")
        return

    msg = "🔎 **ရှာဖွေတွေ့ရှိသော ဂိမ်းများ:**\n\n"
    keyboard = []
    bot_username = (await context.bot.get_me()).username
    for key, name in results:
        msg += f"🎮 **{name}**\n"
        game_url = f"https://t.me/{bot_username}?start={key}"
        keyboard.append([InlineKeyboardButton(f"📥 {name} ရယူရန်", url=game_url)])

    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(msg, reply_markup=reply_markup, parse_mode="Markdown")

# --- CONVERSATION HANDLER FOR ADD GAME ---

async def add_game_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    user = update.effective_user
    if user.id != ADMIN_ID:
        await update.message.reply_text("⛔ ဒီ Command ကို Admin တစ်ဦးတည်းသာ သုံးလို့ရပါတယ်။")
        return ConversationHandler.END
        
    await update.message.reply_text(
        "🎮 **ဂိမ်းအသစ် စတင်ထည့်သွင်းခြင်း**\n\n"
        "ကျေးဇူးပြု၍ **Game Key** နဲ့ **ဂိမ်းနာမည်** ကို အောက်ပါပုံစံအတိုင်း ပို့ပေးပါ:\n\n"
        "`dave_the_diver | Dave the Diver`",
        parse_mode="Markdown"
    )
    return GET_NAME

async def receive_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text
    parts = text.split("|")
    if len(parts) < 2:
        await update.message.reply_text("⚠️ ပုံစံမမှန်ပါ။ `key | Name` ပုံစံအတိုင်း ပြန်လည် ပို့ပေးပါ:")
        return GET_NAME
        
    context.user_data['game_key'] = parts[0].strip()
    context.user_data['game_name'] = parts[1].strip()
    
    await update.message.reply_text(
        "🖼️ ကျေးဇူးတင်ပါတယ်။\n\n"
        "ယခု **ဂိမ်းပုံ (Photo)** တစ်ပုံကို ဓာတ်ပုံပုံစံ (Photo) အနေနဲ့ ပို့ပေးပါ။"
    )
    return GET_PHOTO

async def receive_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message.photo:
        await update.message.reply_text("⚠️ ကျေးဇူးပြု၍ ပုံ (Photo) ကိုသာ ပို့ပေးပါ။")
        return GET_PHOTO
        
    photo_id = update.message.photo[-1].file_id
    context.user_data['game_image'] = photo_id
    
    keyboard = [
        [InlineKeyboardButton("📁 Telegram File တင်မည် (APK)", callback_data="apk_type_file")],
        [InlineKeyboardButton("🔗 Direct Link ထည့်မည် (APK/URL)", callback_data="apk_type_link")]
    ]
    await update.message.reply_text(
        "📱 **APK ဖိုင် (သို့) Main App ပိုင်းအတွက် ရွေးချယ်ပါ:**",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )
    return GET_APK_CHOICE

async def apk_choice_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    
    if query.data == "apk_type_file":
        context.user_data['apk_type'] = 'file'
        await query.message.reply_text("📥 ကျေးဇူးပြု၍ **APK ဖိုင်** ကို တိုက်ရိုက် တင်ပေးပါ (Document ပုံစံဖြင့်):")
    else:
        context.user_data['apk_type'] = 'link'
        await query.message.reply_text("🔗 ကျေးဇူးပြု၍ **APK ၏ Direct Download Link** ကို စာသား (Text) အနေဖြင့် ပို့ပေးပါ:")
    return GET_APK_CONTENT

async def receive_apk_content(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    apk_type = context.user_data.get('apk_type')
    
    if apk_type == 'file':
        document = update.message.document or update.message.video or update.message.audio
        if not document:
            await update.message.reply_text("⚠️ ကျေးဇူးပြု၍ ဖိုင် (Document/APK) ကိုသာ ပို့ပေးပါ။")
            return GET_APK_CONTENT
        context.user_data['apk_value'] = document.file_id
    else:
        if not update.message.text:
            await update.message.reply_text("⚠️ ကျေးဇူးပြု၍ Direct Link စာသားကိုသာ ပို့ပေးပါ။")
            return GET_APK_CONTENT
        context.user_data['apk_value'] = update.message.text.strip()
        
    # OBB / Data Option
    keyboard = [
        [InlineKeyboardButton("📁 Telegram File ဖြင့် OBB တင်မည်", callback_data="obb_type_file")],
        [InlineKeyboardButton("🔗 Direct Link ဖြင့် OBB ထည့်မည်", callback_data="obb_type_link")],
        [InlineKeyboardButton("❌ OBB မလိုပါ (Skip)", callback_data="obb_type_none")]
    ]
    await update.message.reply_text(
        "📦 **OBB / Data ဖိုင် လိုအပ်ပါသလား?** ရွေးချယ်ပေးပါ။",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )
    return GET_OBB_CHOICE

async def obb_choice_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    
    if query.data == "obb_type_file":
        context.user_data['obb_type'] = 'file'
        await query.message.reply_text("📥 ကျေးဇူးပြု၍ **OBB / Data ဖိုင်** ကို တိုက်ရိုက် တင်ပေးပါ:")
        return GET_OBB_CONTENT
    elif query.data == "obb_type_link":
        context.user_data['obb_type'] = 'link'
        await query.message.reply_text("🔗 ကျေးဇူးပြု၍ **OBB ရဲ့ Direct Link** ကို စာသားအနေဖြင့် ပို့ပေးပါ:")
        return GET_OBB_CONTENT
    else:
        context.user_data['obb_type'] = 'none'
        context.user_data['obb_value'] = None
        return await save_game_to_db(update, context)

async def receive_obb_content(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    obb_type = context.user_data.get('obb_type')
    
    if obb_type == 'file':
        document = update.message.document or update.message.video or update.message.audio
        if not document:
            await update.message.reply_text("⚠️ ကျေးဇူးပြု၍ OBB ဖိုင်ကိုသာ ပို့ပေးပါ။")
            return GET_OBB_CONTENT
        context.user_data['obb_value'] = document.file_id
    else:
        if not update.message.text:
            await update.message.reply_text("⚠️ ကျေးဇူးပြု၍ OBB Link စာသားကိုသာ ပို့ပေးပါ။")
            return GET_OBB_CONTENT
        context.user_data['obb_value'] = update.message.text.strip()
        
    return await save_game_to_db(update, context)

async def save_game_to_db(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    game_key = context.user_data.get('game_key')
    game_name = context.user_data.get('game_name')
    game_image = context.user_data.get('game_image')
    apk_type = context.user_data.get('apk_type')
    apk_value = context.user_data.get('apk_value')
    obb_type = context.user_data.get('obb_type')
    obb_value = context.user_data.get('obb_value')
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO games (key, name, image, apk_type, apk_value, obb_type, obb_value) 
            VALUES (%s, %s, %s, %s, %s, %s, %s) 
            ON CONFLICT (key) DO UPDATE SET 
                name = EXCLUDED.name, 
                image = EXCLUDED.image,
                apk_type = EXCLUDED.apk_type,
                apk_value = EXCLUDED.apk_value,
                obb_type = EXCLUDED.obb_type,
                obb_value = EXCLUDED.obb_value;
            """,
            (game_key, game_name, game_image, apk_type, apk_value, obb_type, obb_value)
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        msg_target = update.message or update.callback_query.message
        await msg_target.reply_text(f"⚠️ Database ထဲ သိမ်းရာတွင် Error ဖြစ်သွားသည်: {e}")
        return ConversationHandler.END
    
    bot_username = (await context.bot.get_me()).username
    success_msg = (
        f"✅ **ဂိမ်းအသစ်ကို Supabase သို့ အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ!**\n\n"
        f"🎮 **နာမည်:** {game_name}\n"
        f"🔗 **Share Link:** `https://t.me/{bot_username}?start={game_key}`"
    )
    
    if update.callback_query:
        await update.callback_query.message.reply_text(success_msg, parse_mode="Markdown")
    else:
        await update.message.reply_text(success_msg, parse_mode="Markdown")
        
    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("❌ ဂိမ်းထည့်သွင်းမှုကို ဖျက်သိမ်းလိုက်ပါပြီ။")
    return ConversationHandler.END

async def del_game(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if user.id != ADMIN_ID:
        await update.message.reply_text("⛔ ဒီ Command ကို Admin တစ်ဦးတည်းသာ သုံးလို့ရပါတယ်။")
        return
        
    if not context.args:
        await update.message.reply_text("⚠️ ဖျက်ချင်တဲ့ ဂိမ်းရဲ့ Key ကို ထည့်ပေးပါ။\n\n`/del_game dave_the_diver`", parse_mode="Markdown")
        return
        
    game_key = context.args[0].strip()
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM games WHERE key = %s;", (game_key,))
        deleted_rows = cur.rowcount
        conn.commit()
        cur.close()
        conn.close()
        
        if deleted_rows > 0:
            await update.message.reply_text(f"🗑️ **ဂိမ်း ({game_key}) ကို Supabase မှ အောင်မြင်စွာ ဖျက်လိုက်ပါပြီ!**", parse_mode="Markdown")
        else:
            await update.message.reply_text(f"⚠️ `{game_key}` ဆိုတဲ့ နာမည်နဲ့ ဂိမ်း Database ထဲမှာ မရှိပါ။", parse_mode="Markdown")
    except Exception as e:
        await update.message.reply_text(f"⚠️ Error: {e}")

async def button_click(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    
    if query.data.startswith("get_files_"):
        game_key = query.data.replace("get_files_", "")
        db = load_db()
        game_info = db.get(game_key, {})
        game_name = game_info.get("name", "Game")
        
        if not context.user_data.get('unlocked', False):
            context.user_data['unlocked'] = True
            await query.answer(
                text="⚠️ အရင်ဆုံး အပေါ်က '🔓 Unlock Download Link (Ad)' ကို နှိပ်ပြီး ကြော်ငြာကြည့်ပေးပါ။",
                show_alert=True
            )
        else:
            await query.answer()
            try:
                # အချက်အလက်များ ထုတ်ပေးရန် Keyboard တည်ဆောက်ခြင်း
                keyboard = []
                
                apk_type = game_info.get("apk_type")
                apk_value = game_info.get("apk_value")
                obb_type = game_info.get("obb_type")
                obb_value = game_info.get("obb_value")
                
                # 1. APK Button Handling
                if apk_type == 'link':
                    keyboard.append([InlineKeyboardButton("📥 Download APK (Direct Link)", url=apk_value)])
                
                # 2. OBB Button Handling
                if obb_type == 'link' and obb_value:
                    keyboard.append([InlineKeyboardButton("📦 Download OBB / Data (Direct Link)", url=obb_value)])
                
                reply_markup = InlineKeyboardMarkup(keyboard) if keyboard else None
                
                # Text info message
                info_msg = f"✅ **Unlock အောင်မြင်ပါပြီ!**\n🚀 **{game_name}** ဖိုင်များကို အောက်ပါအတိုင်း ရယူနိုင်ပါပြီ။"
                await context.bot.send_message(chat_id=query.message.chat_id, text=info_msg, reply_markup=reply_markup, parse_mode="Markdown")
                
                # Telegram File များကို ပို့ပေးခြင်း (APK သို့မဟုတ် OBB File ဖြစ်နေလျှင်)
                if apk_type == 'file' and apk_value:
                    await context.bot.send_document(chat_id=query.message.chat_id, document=apk_value, caption=f"📱 **{game_name} (APK File)**")
                
                if obb_type == 'file' and obb_value:
                    await context.bot.send_document(chat_id=query.message.chat_id, document=obb_value, caption=f"📦 **{game_name} (OBB / Data File)**")
                    
            except Exception as e:
                await query.message.reply_text(f"⚠️ ဖိုင်ပို့ရာတွင် Error ဖြစ်သွားသည်: {e}")

def main():
    threading.Thread(target=run_dummy_server, daemon=True).start()

    application = Application.builder().token(BOT_TOKEN).build()
    
    conv_handler = ConversationHandler(
        entry_points=[CommandHandler("add_game", add_game_start)],
        states={
            GET_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_name)],
            GET_PHOTO: [MessageHandler(filters.PHOTO, receive_photo)],
            GET_APK_CHOICE: [CallbackQueryHandler(apk_choice_handler, pattern="^apk_type_")],
            GET_APK_CONTENT: [
                MessageHandler(filters.Document.ALL | filters.VIDEO | filters.AUDIO, receive_apk_content),
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_apk_content)
            ],
            GET_OBB_CHOICE: [CallbackQueryHandler(obb_choice_handler, pattern="^obb_type_")],
            GET_OBB_CONTENT: [
                MessageHandler(filters.Document.ALL | filters.VIDEO | filters.AUDIO, receive_obb_content),
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_obb_content)
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )

    application.add_handler(conv_handler)
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("search", search_game))
    application.add_handler(CommandHandler("del_game", del_game))
    application.add_handler(CallbackQueryHandler(button_click))

    print("Bot starting successfully with Supabase and APK/OBB options...")
    application.run_polling()

if __name__ == '__main__':
    main()
