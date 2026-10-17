import logging
import json
import os
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes

# Logging သတ်မှတ်ခြင်း
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# ---------------- CONFIGURATION ----------------
BOT_TOKEN = "8840218731:AAExjF4reevpsWZ7yKPcL5QKYRxfApQW980"

# မင်းရဲ့ Adsterra Direct Link (Smartlink)
ADSTERRA_DIRECT_LINK = "https://asiafilm.org/4/c5943dad7af79670ea07ba03b2199713"

# **မင်းရဲ့ Telegram User ID ကို ဒီမှာ ထည့်ပါ (Admin ဖြစ်ရန်)**
ADMIN_ID = 123456789  # <--- ဒီနေရာမှာ မင်းရဲ့ Telegram Admin ID အမှန်ကို ထည့်ပါ

DB_FILE = "games_db.json"

# Database ဖိုင် Load / Save လုပ်ရန်
def load_db():
    if os.path.exists(DB_FILE):
        with open(DB_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_db(data):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

# ---------------- HANDLERS ----------------

# /start Command (ဂိမ်းရှာဖွေရန်)
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    args = context.args
    
    db = load_db()
    game_key = args[0] if args else list(db.keys())[0] if db else None
    
    if not game_key or game_key not in db:
        await update.message.reply_text("⚠️ လက်လောလောဆယ် တင်ထားသော ဂိမ်းများ မရှိသေးပါ သားရီး။ Admin မှ ဂိမ်းအသစ် ထည့်သွင်းရန် စောင့်ဆိုင်းနေပါသည်။")
        return
        
    game_info = db[game_key]
    game_name = game_info["name"]
    game_link = game_info["link"]
    game_image = game_info["image"]
    
    context.user_data['unlocked'] = False
    context.user_data['game_link'] = game_link
    
    welcome_text = (
        f"🔥 **Hey {user.first_name}!** 🔥\n\n"
        f"🎮 **ဂိမ်းအမည်:** {game_name}\n\n"
        "⚡ အောက်ပါ ခလုတ်ကို နှိပ်ပြီး Adsterra ကြော်ငြာဖြတ်ကာ ဂိမ်းဖိုင် ရယူပါ။"
    )
    
    keyboard = [
        [
            InlineKeyboardButton(
                "🔓 Unlock Download Link (Ad)", 
                url=ADSTERRA_DIRECT_LINK
            )
        ],
        [
            InlineKeyboardButton(
                "📥 Game File ရယူရန်", 
                callback_data=f"get_file_{game_key}"
            )
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    try:
        await update.message.reply_photo(
            photo=game_image,
            caption=welcome_text,
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )
    except Exception:
        await update.message.reply_text(
            text=welcome_text,
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )

# Admin က ဂိမ်းအသစ်ထည့်ရန် ပုံစံ: /add_game game_key | ဂိမ်းနာမည် | ဖိုင်လင့်ခ် | ပုံလင့်ခ်
async def add_game(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    
    # Admin ဟုတ်မဟုတ် စစ်ဆေးခြင်း
    if user.id != ADMIN_ID:
        await update.message.reply_text("⛔ ဒီ Command ကို Admin တစ်ဦးတည်းသာ သုံးလို့ရပါတယ် သားရီး။")
        return
        
    text = " ".join(context.args)
    parts = text.split("|")
    
    if len(parts) < 4:
        await update.message.reply_text(
            "⚠️ ပုံစံမမှန်ပါဘူး သားရီး။ ဤကဲ့သို့ ရိုက်ထည့်ပါ:\n\n"
            "`/add_game neverness | Neverness to Everness | https://t.me/... | https://image.url`",
            parse_mode="Markdown"
        )
        return
        
    game_key = parts[0].strip()
    game_name = parts[1].strip()
    game_link = parts[2].strip()
    game_image = parts[3].strip()
    
    db = load_db()
    db[game_key] = {
        "name": game_name,
        "link": game_link,
        "image": game_image
    }
    save_db(db)
    
    await update.message.reply_text(
        f"✅ **ဂိမ်းအသစ် အောင်မြင်စွာ ထည့်ပြီးပါပြီကွ!**\n\n"
        f"🎮 **နာမည်:** {game_name}\n"
        f"🔗 **Share Link:** `https://t.me/your_bot_username?start={game_key}`",
        parse_mode="Markdown"
    )

# Button Click Handle လုပ်ခြင်း
async def button_click(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    
    if query.data.startswith("get_file_"):
        target_link = context.user_data.get('game_link', "https://t.me/your_channel")
        
        if not context.user_data.get('unlocked'):
            context.user_data['unlocked'] = True
            await query.answer(
                "⚠️ အရင်ဆုံး အပေါ်က '🔓 Unlock Download Link (Ad)' ကို နှိပ်ပြီးမှ ဖိုင်ရယူပါခင်ဗျာ။",
                show_alert=True
            )
        else:
            await query.edit_message_caption(
                caption=(
                    "✅ **Unlock အောင်မြင်ပါပြီ!**\n\n"
                    f"🔗 **Download Link:** {target_link}"
                ),
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton("🚀 Go To Download", url=target_link)]
                ])
            )

def main():
    application = Application.builder().token(BOT_TOKEN).build()
    
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("add_game", add_game))
    application.add_handler(CallbackQueryHandler(button_click))

    print("Bot starting successfully with Database & Admin Panel...")
    application.run_polling()

if __name__ == '__main__':
    main()
