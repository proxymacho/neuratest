const express = require('express');
const fs = require('fs');
const app = express();
app.use(express.json());

// Настройка CORS перед маршрутами
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

const DB_FILE = 'users.json';

function readDB() {
    if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));
    return JSON.parse(fs.readFileSync(DB_FILE));
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.post('/register', (req, res) => {
    console.log('Received registration request:', req.body);
    const users = readDB();
    const existingUser = users.find(u => u.login === req.body.login);
    if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
    }
    users.push(req.body);
    writeDB(users);
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

app.post('/update-wallet', (req, res) => {
    console.log('Received wallet update request:', req.body);
    const users = readDB();
    const user = users.find(u => u.id === req.body.id);
    if (user) {
        user.wallet = req.body.wallet;
        user.seeds = req.body.seeds;
        writeDB(users);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

app.get('/users', (req, res) => {
    res.json(readDB());
});

app.post('/update-user', (req, res) => {
    console.log('Received user update request:', req.body);
    const users = readDB();
    const user = users.find(u => u.id === req.body.id);
    if (user) {
        Object.assign(user, req.body);
        writeDB(users);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));