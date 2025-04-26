const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');

const app = express();
app.use(express.json());

// Bot configuration
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL; // Set in hosting platform
const bot = new TelegramBot(BOT_TOKEN, { polling: false }); // Webhooks for production

// Template path
const TEMPLATE_PATH = path.join(__dirname, 'public', 'templates', 'umkc.png');

// Set webhook on startup
async function setWebhook() {
  if (!WEBHOOK_URL) {
    console.error('WEBHOOK_URL not set. Webhook not configured.');
    return;
  }
  try {
    await bot.setWebHook(`${WEBHOOK_URL}/${BOT_TOKEN}`);
    console.log(`Webhook set to ${WEBHOOK_URL}/${BOT_TOKEN}`);
  } catch (error) {
    console.error('Error setting webhook:', error.message);
  }
}

// Handle /start command
// Handle /start command
bot.onText(/\/start/, (msg) => {
    console.log('Received /start command from', msg.chat.id);
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Welcome to the ወላይታ ሶዶ ዩኒቨርስቲ አከባቢ መሠረተ ክርስቶስ ቤተክርስቲያን - እነሆ ኢየሱስ የዝማሬ ድግስ Bot! We\'re excited to celebrate with you! Please send a portrait photo, and I will send you our festival graphic.');
  
  });

// Handle photo messages
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  console.log('Received photo from', chatId);
  
  try {
    // Verify template file exists
    try {
      await fs.access(TEMPLATE_PATH);
    } catch (error) {
      throw new Error(`Template file not found or inaccessible: ${TEMPLATE_PATH}`);
    }

    // Get the highest resolution photo
    const photo = msg.photo[msg.photo.length - 1];
    const file = await bot.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    
    // Download the photo
    console.log('Downloading photo from:', fileUrl);
    const response = await axios({
      url: fileUrl,
      responseType: 'arraybuffer',
    });
    const userPhotoBuffer = Buffer.from(response.data);
    
    // Validate user photo buffer
    if (!userPhotoBuffer || userPhotoBuffer.length === 0) {
      throw new Error('Downloaded photo buffer is empty or invalid');
    }

    // Load template and get its dimensions
    console.log('Loading template:', TEMPLATE_PATH);
    const template = sharp(TEMPLATE_PATH).png();
    const templateMetadata = await template.metadata();
    console.log('Template dimensions:', templateMetadata.width, 'x', templateMetadata.height);
    
    // Load user photo, handle orientation, and resize to match template dimensions
    console.log('Processing user photo');
    const userPhoto = await sharp(userPhotoBuffer)
      .rotate() // Handle EXIF orientation
      .resize({
        width: templateMetadata.width,
        height: templateMetadata.height,
        fit: 'cover',
        position: 'left',
      })
      .png()
      .toBuffer();
    
    // Calculate position for middle-left alignment
    const leftOffset = -20; // Negative offset to shift left
    const topOffset = 0; // Photo matches template height
    console.log('Compositing with offsets:', { leftOffset, topOffset });
    
    // Composite the user photo as background and template as foreground
    const resultBuffer = await sharp({
      create: {
        width: templateMetadata.width,
        height: templateMetadata.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .composite([
        { input: userPhoto, left: leftOffset, top: topOffset },
        { input: TEMPLATE_PATH, left: 0, top: 0 },
      ])
      .toBuffer();
    
    // Send the result back to the user with a filename
    console.log('Sending result photo to user');
    await bot.sendPhoto(chatId, resultBuffer, {
      caption: 'Here is your photo with our festival graphics!',
      filename: 'result.png',
    });
    
  } catch (error) {
    console.error('Error processing photo:', error.message, error.stack);
    await bot.sendMessage(chatId, `Sorry, there was an error processing your photo: ${error.message}`);
  }
});

// Error handling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error.message, error.stack);
});

// Express routes
app.get('/', (req, res) => {
  res.send('Telegram Bot Server is running');
});

app.post(`/${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.status(200).send('OK');
});

// Start the server and set webhook
const PORT = process.env.PORT || 8443;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await setWebhook();
});