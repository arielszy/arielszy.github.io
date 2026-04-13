const express = require(express);
const fs = require(fs);
const path = require(path);
const cors = require(cors);

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, database.json);

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

function readDatabase() {
    if (!fs.existsSync(DB_FILE)) {
        return { clients: [], orders: [], payments: [] };
    }
    const data = fs.readFileSync(DB_FILE, utf8);
    return JSON.parse(data || {clients:[],orders:[],payments:[]});
}

function writeDatabase(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.post(/api/clients, (req, res) => {
    const db = readDatabase();
    db.clients.push(req.body);
    writeDatabase(db);
    res.json({ success: true, data: req.body });
});

app.get(/api/clients, (req, res) => {
    const db = readDatabase();
    res.json(db.clients);
});

app.put(/api/clients, (req, res) => {
    const db = readDatabase();
    const index = db.clients.findIndex(c => c.id === req.body.id);
    if (index > -1) {
        db.clients[index] = req.body;
        writeDatabase(db);
    }
    res.json({ success: true });
});

app.delete(/api/clients, (req, res) => {
    const db = readDatabase();
    db.clients = db.clients.filter(c => c.id !== req.body.id);
    writeDatabase(db);
    res.json({ success: true });
});

app.post(/api/orders, (req, res) => {
    const db = readDatabase();
    db.orders.push(req.body);
    writeDatabase(db);
    res.json({ success: true, data: req.body });
});

app.get(/api/orders, (req, res) => {
    const db = readDatabase();
    res.json(db.orders);
});

app.put(/api/orders, (req, res) => {
    const db = readDatabase();
    const index = db.orders.findIndex(o => o.id === req.body.id);
    if (index > -1) {
        db.orders[index] = req.body;
        writeDatabase(db);
    }
    res.json({ success: true });
});

app.delete(/api/orders, (req, res) => {
    const db = readDatabase();
    db.orders = db.orders.filter(o => o.id !== req.body.id);
    writeDatabase(db);
    res.json({ success: true });
});

app.post(/api/payments, (req, res) => {
    const db = readDatabase();
    db.payments.push(req.body);
    writeDatabase(db);
    res.json({ success: true, data: req.body });
});

app.get(/api/payments, (req, res) => {
    const db = readDatabase();
    res.json(db.payments);
});

app.put(/api/payments, (req, res) => {
    const db = readDatabase();
    const index = db.payments.findIndex(p => p.id === req.body.id);
    if (index > -1) {
        db.payments[index] = req.body;
        writeDatabase(db);
    }
    res.json({ success: true });
});

app.delete(/api/payments, (req, res) => {
    const db = readDatabase();
    db.payments = db.payments.filter(p => p.id !== req.body.id);
    writeDatabase(db);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});