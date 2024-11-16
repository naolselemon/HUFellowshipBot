from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, CallbackContext
from PIL import Image, ImageDraw, ImageFont
import requests
import io
import os
from dotenv import load_dotenv
from flask import Flask, request
import asyncio

load_dotenv()

TOKEN = os.getenv("BOT_TOKEN")

BASE_URL = f'https://api.telegram.org/bot{TOKEN}/'

app = Flask(__name__)

async def start(update: Update, context: CallbackContext):
    await update.message.reply_text("Hello, send me a Photo and I will provide you HUDigitalGospel Graphics!")

async def handle_photo(update: Update, context: CallbackContext):
    try:
        # Fetch the highest resolution photo
        photo_file = await update.message.photo[-1].get_file()
        photo_url = photo_file.file_path
        photo_data = requests.get(photo_url).content
        
        # Apply template text overlay
        template_image = generate_template(photo_data)

        # Save the image to an in-memory BytesIO buffer in PNG format
        bio = io.BytesIO()
        template_image.save(bio, format='PNG')
        bio.seek(0)

        # Send the edited image back as a photo
        await update.message.reply_photo(photo=bio)

    except Exception as e:
        await update.message.reply_text(f"An error occurred: {e}")

def generate_template(photo_data):

    template_path = os.path.join(os.getcwd(), "public", "templates", "transparent.png")

    template_image = Image.open(template_path).convert("RGBA")

    user_photo = Image.open(io.BytesIO(photo_data)).convert("RGBA")
    user_photo = user_photo.resize(template_image.size)

    template_image = Image.blend(template_image, user_photo, alpha=0.6)  # Apply semi-transparent blending for the photo overlay


    return template_image

@app.route('/webhook', methods=['POST'])

def webhook():
    json_str = request.get_data().decode('utf-8')
    update = update.de_json(json_str, None)

    Application.process_update(update)
    return "ok"

def main():
    application = Application.builder().token(TOKEN).connect_timeout(10).read_timeout(10).build()

    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    
    webhook_url = "https://hufellowshipbot.onrender.com/webhook"


    async def set_webhook_and_run():
        await application.bot.set_webhook(webhook_url)

        app.run(host="0.0.0.0", port=5000)
    asyncio.run(set_webhook_and_run())

if __name__ == '__main__':
    main()
