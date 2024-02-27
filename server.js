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


// Define schemas for MongoDB collections

// Schema for menus
const menusSchema = new mongoose.Schema({
    name: String,
    allergenInfo: String,
    price: Number,
});

// Schema for recipes
const recipesSchema = new mongoose.Schema({
    name: String,
    allergenInfo: String,
    recipe: String
});

// Schema for misc (collection with miscellaneous documents)
const miscSchema = new mongoose.Schema({
    documentName: String,
    information: String
});

// Schema for openingHours
const openingHoursSchema = new mongoose.Schema({
    day: String,
    openingTime: String,
    closingTime: String
});

// Create models based on schemas
const menusModel = mongoose.model('menus', menusSchema); // Model for menus
const recipesModel = mongoose.model('recipes', recipesSchema); // Model for recipes
const miscModel = mongoose.model('misc', miscSchema, 'misc'); // Model for misc
const openingHoursModel = mongoose.model('openingHours', openingHoursSchema, 'openingHours'); // Model for openingHours

// Route point for the home page
app.get('/', (req, res) => {
    res.send('Home Page');
});


// Route to get all of the menu items from the menu collection of the database and sends them as a response to the client.
app.get('/menu', async (req, res) => {
    
    try {
        const menuItems = await menusModel.find({});
        console.log(menuItems);
        res.json(menuItems);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Route to get all of the recipes from the recipe collection of the database and sends them as a response to the client.
app.get('/recipes', async (req, res) => {

    try {
        const recipes = await recipesModel.find({});
        console.log(recipes);
        res.json(recipes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Route to get the food pantry information from the misc collection of the database and sends it as a response to the client.
app.get('/food_pantry', async (req, res) => {
    getAndSendMiscDocument(res, "FoodPantry")
});

// Route to get the opening hours from the openingHours collection of the database and sends it as a response to the client.
app.get('/opening_hours', async (req, res) => {
    try {
        const openingHours = await openingHoursModel.find({});
        console.log(openingHours);
        res.json(openingHours);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Function to find and send miscellaneous documents from the misc collection
async function getAndSendMiscDocument(res, selectedDocumentName){
    try {
        // Query to find document with the selectedDocumentName
        const resultingDocument = await miscModel.findOne({ documentName: selectedDocumentName });
        
        if (!resultingDocument) {
            return res.status(404).json({ message: "Sorry, this information could not be found" });
        }

        console.log(resultingDocument);
        res.json(resultingDocument);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// Listen on the selected port
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})