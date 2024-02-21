const express = require('express');
const mongoose = require('mongoose');
const app = express();
const port = 4000;

// Use cors to allow cross origin requests
const cors = require('cors');
app.use(cors());
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Use body-parser for POST method
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect('mongodb://0.0.0.0:27017/Y3_Canteen_Project_Temp_Test') // This is a local test MongoDB database
    .then(() => {
        console.log('MongoDB connected successfully');
    })
    .catch((error) => {
        console.error('MongoDB connection error:', error);
    });

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Schema for Menu
const menuItemSchema = new mongoose.Schema({
    name: String,
    allergenInfo: String,
    price: Number,
});

const MenuItem = mongoose.model('Menu', menuItemSchema, 'Menu');

// Route point for the home page
app.get('/', (req, res) => {
    res.send('Home Page');
});


// Finds all of the menu items in the Menu collection of the database and sends them as a response to the client.
app.get('/menu', async (req, res) => {
    
    try {
        const menuItems = await MenuItem.find({});
        console.log(menuItems);
        res.json(menuItems);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// Listen on the selected port
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})