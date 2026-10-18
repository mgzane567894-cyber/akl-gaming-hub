import logging
import os
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import psycopg2
from psycopg2.extras import RealDictCursor
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes

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
BOT_TOKEN = "8840218731:AAExjF4reevpsWZ7yKPcL5QKYRxfApQW980"
ADSTERRA_DIRECT_LINK = "https://asiafilm.org/4/c5943dad7af79670ea07ba03b2199713"
ADMIN_ID = 7122952141

# Supabase Database URL (Transaction Pooler - IPv4 Compatible)
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres.ncjrzuhpdiwrjveogpmt:aungkhainglin12@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres")

WELCOME_IMAGE = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhCrFvWn7BeKrQtNho2cu_CqR-X0f8BuptBTTIt4fzBbAc-rGTu_dQ1pQLUkMGmsRboaG49JqB4jqQXzUJ-W2obNGmN-EwGVcwFMLQnpSO_ZvLNGhTinvQkc1SWOmFmD-ZgelySMmNMqx0qE3UeYIG6OSt06Xd1gu7Hbpc2lPnXm3jw5_9a0E4W_VNYnj0/s736/45709.jpg"

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
                "link": row['link'],
                "image": row['image']
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
    
    # 1. /start သက်သက် နှုတ်ဆက်စာမျက်နှာ
    if not args:
        welcome_text = (
            f"🔥 **မင်္ဂလာပါ {user.first_name}!** 🔥\n\n"
            "🎮 **AKL Gaming Hub File Bot မှ နွေးထွေးစွာ ကြိုဆိုပါတယ် သားရီး!**\n\n"
            "🔍 **ဂိမ်းများ ရှာဖွေလိုပါက အောက်ပါအတိုင်း ရိုက်ရှာနိုင်ပါတယ် -**\n"
            "👉 `/search ဂိမ်းနာမည်`\n"
            "*(ဥပမာ - `/search simulator` သို့မဟုတ် `/search construction`)*"
        )
        
        try:
            await update.message.reply_photo(photo=WELCOME_IMAGE, caption=welcome_text, parse_mode="Markdown")
        except Exception:
            await update.message.reply_text(text=welcome_text, parse_mode="Markdown")
        return

    # 2. ဂိမ်းလင့်ခ်မှတဆင့် ဝင်လာသောအခါ
    game_key = args[0]
    if game_key not in db:
        await update.message.reply_text("⚠️ ဒီဂိမ်း မရှိသေးပါ သားရီး။ မကြာမီ တင်ပေးပါမည်။")
        return
        
    game_info = db[game_key]
    game_name = game_info["name"]
    game_image = game_info["image"]
    
    context.user_data['unlocked'] = False
    context.user_data['game_key'] = game_key  # Callback အတွက် သိမ်းထားမည်
    
    game_text = (
        f"🔥 **Hey {user.first_name}!** 🔥\n\n"
        f"🎮 **ဂိမ်းအမည်:** {game_name}\n\n"
        "⚡ **ဂိမ်းဖိုင် ရယူရန် အဆင့်များ:**\n"
        "၁။ အောက်ပါ **'🔓 Unlock Download Link (Ad)'** ကို တစ်ချက်နှိပ်ပြီး ကြော်ငြာကြည့်ပေးပါ။\n"
        "၂။ ပြီးလျှင် အဲ့ထဲ ပြန်ထွက်လာပြီး **'📥 Game File ရယူရန်'** ကို နှိပ်ပါ သားရီး!"
    )
    
    keyboard = [
        [
            InlineKeyboardButton("🔓 Unlock Download Link (Ad)", url=ADSTERRA_DIRECT_LINK)
        ],
        [
            InlineKeyboardButton("📥 Game File ရယူရန်", callback_data=f"get_file_{game_key}")
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    try:
        if game_image and game_image.startswith("http"):
            await update.message.reply_photo(photo=game_image, caption=game_text, reply_markup=reply_markup, parse_mode="Markdown")
        else:
            raise Exception("Invalid image URL")
    except Exception:
        await update.message.reply_text(text=game_text, reply_markup=reply_markup, parse_mode="Markdown")

async def search_game(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not context.args:
        await update.message.reply_text(
            "⚠️ ရှာချင်တဲ့ ဂိမ်းနာမည် ရိုက်ထည့်ပေးပါ သားရီး။\n\n"
            "ဥပမာ- `/search simulator`",
            parse_mode="Markdown"
        )
        return

    query = " ".join(context.args).lower()
    db = load_db()
    results = []

    for key, data in db.items():
        if query in data["name"].lower() or query in key.lower():
            results.append((key, data["name"]))

    if not results:
        await update.message.reply_text(f"⚠️ `{query}` နာမည်နဲ့ ပတ်သက်တဲ့ ဂိမ်း ရှာမတွေ့ပါဘူး သားရီး။", parse_mode="Markdown")
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

async def add_game(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if user.id != ADMIN_ID:
        await update.message.reply_text("⛔ ဒီ Command ကို Admin တစ်ဦးတည်းသာ သုံးလို့ရပါတယ် သားရီး။")
        return
        
    text = " ".join(context.args)
    parts = text.split("|")
    if len(parts) < 3:
        await update.message.reply_text("⚠️ ပုံစံမမှန်ပါဘူး သားရီး။ ဤကဲ့သို့ ရိုက်ထည့်ပါ:\n\n`/add_game dave_the_diver | Dave the Diver | https://image.url`\n*(မှတ်ချက်။ ။ ဂိမ်းဖိုင်ကို Reply ပေးပြီးမှ ဤကွန်မန်းကို သုံးပါ)*", parse_mode="Markdown")
        return
        
    game_key, game_name, game_image = parts[0].strip(), parts[1].strip(), parts[2].strip()
    
    # Reply ပေးထားသော မက်ဆေ့ချ်ထဲမှ ဖိုင် (Document သို့မဟုတ် Video) ကို ရယူခြင်း
    reply_msg = update.message.reply_to_message
    if not reply_msg or not (reply_msg.document or reply_msg.video or reply_msg.audio):
        await update.message.reply_text("⚠️ ကျေးဇူးပြု၍ ဂိမ်းဖိုင် (APK) ကို လက်ညှိုးထိုး Reply ပေးပြီးမှ `/add_game` ကို သုံးပါ သားရီး။")
        return
        
    file_id = reply_msg.document.file_id if reply_msg.document else (reply_msg.video.file_id if reply_msg.video else reply_msg.audio.file_id)
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO games (key, name, link, image) VALUES (%s, %s, %s, %s) ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, link = EXCLUDED.link, image = EXCLUDED.image;",
            (game_key, game_name, file_id, game_image)
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        await update.message.reply_text(f"⚠️ Database ထဲ သိမ်းရာတွင် Error ဖြစ်သွားပါသည် သားရီး: {e}")
        return
    
    bot_username = (await context.bot.get_me()).username
    await update.message.reply_text(
        f"✅ **ဂိမ်းဖိုင်နှင့်တကွ Supabase သို့ အောင်မြင်စွာ သိမ်းပြီးပါပြီကွ!**\n\n"
        f"🎮 **နာမည်:** {game_name}\n"
        f"🔗 **Share Link:** `https://t.me/{bot_username}?start={game_key}`",
        parse_mode="Markdown"
    )

async def del_game(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if user.id != ADMIN_ID:
        await update.message.reply_text("⛔ ဒီ Command ကို Admin တစ်ဦးတည်းသာ သုံးလို့ရပါတယ် သားရီး။")
        return
        
    if not context.args:
        await update.message.reply_text("⚠️ ဖျက်ချင်တဲ့ ဂိမ်းရဲ့ Key ကို ထည့်ပေးပါ သားရီး။\n\n`/del_game dave_the_diver`", parse_mode="Markdown")
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
            await update.message.reply_text(f"🗑️ **ဂိမ်း ({game_key}) ကို Supabase မှ အောင်မြင်စွာ ဖျက်လိုက်ပါပြီကွ!**", parse_mode="Markdown")
        else:
            await update.message.reply_text(f"⚠️ `{game_key}` ဆိုတဲ့ နာမည်နဲ့ ဂိမ်း Database ထဲမှာ မရှိပါဘူး သားရီး။", parse_mode="Markdown")
    except Exception as e:
        await update.message.reply_text(f"⚠️ Error: {e}")

async def button_click(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    
    if query.data.startswith("get_file_"):
        game_key = query.data.replace("get_file_", "")
        db = load_db()
        game_info = db.get(game_key, {})
        target_file_id = game_info.get("link", "")
        game_name = game_info.get("name", "Game")
        
        if not context.user_data.get('unlocked', False):
            context.user_data['unlocked'] = True
            await query.answer(
                text="⚠️ အရင်ဆုံး အပေါ်က '🔓 Unlock Download Link (Ad)' ကို နှိပ်ပြီး ကြော်ငြာကြည့်ပေးပါ သားရီး!",
                show_alert=True
            )
        else:
            await query.answer()
            try:
                # ฐานข้อมูล ထဲက သိမ်းထားတဲ့ Telegram File ID ဖြင့် ဖိုင်ကို တိုက်ရိုက်ပို့ပေးမည်
                await context.bot.send_document(
                    chat_id=query.message.chat_id,
                    document=target_file_id,
                    caption=f"✅ **Unlock အောင်မြင်ပါပြီ သားရီး!**\n🚀 **{game_name}** ဖိုင်ကို အောင်မြင်စွာ ရယူလိုက်ပါပြီခင်ဗျာ။"
                )
            except Exception as e:
                await query.message.reply_text(f"⚠️ ဖိုင်ပို့ရာတွင် Error ဖြစ်သွားသည်: {e}")

def main():
    threading.Thread(target=run_dummy_server, daemon=True).start()

    application = Application.builder().token(BOT_TOKEN).build()
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("search", search_game))
    application.add_handler(CommandHandler("add_game", add_game))
    application.add_handler(CommandHandler("del_game", del_game))
    application.add_handler(CallbackQueryHandler(button_click))

    print("Bot starting successfully with Supabase pooler & File ID support...")
    application.run_polling()

if __name__ == '__main__':
    main()
