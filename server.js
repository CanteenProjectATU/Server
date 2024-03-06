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

let foodPantryDocumentName = "FoodPantry";

// Route point for the home page
app.get('/', (req, res) => {
    res.send('Home Page');
});


// GET Methods

// Route to get all of the menu items from the menu collection of the database and sends them as a response to the client.
app.get('/menu', async (req, res) => {
    
    getAndSendAllDocumentsInCollection(res, menusModel);
});

// Route to get all of the recipes from the recipe collection of the database and sends them as a response to the client.
app.get('/recipes', async (req, res) => {

    getAndSendAllDocumentsInCollection(res, recipesModel);
});

// Route to get the food pantry information from the misc collection of the database and sends it as a response to the client.
app.get('/food_pantry', async (req, res) => {
    getAndSendSpecificDocument(res, miscModel, foodPantryDocumentName)
});

// Route to get the opening hours from the openingHours collection of the database and sends it as a response to the client.
app.get('/opening_hours', async (req, res) => {

    getAndSendAllDocumentsInCollection(res, openingHoursModel);
});


// POST Methods

// Route to add a new menu item to the menu collection
app.post('/menu', async (req, res) => {

        // Extracting food name, allergy info, and price from the request body
        const { name, allergenInfo, price } = req.body;

        // Checks if the submitted data is valid
        if(stringNotEmpty(name) > 0 && stringNotEmpty(allergenInfo) > 0 && isValidPrice(price))
        {
            let newPrice = Number(price).toFixed(2); // Ensures that there are not more than two numbers after the decimal point

            // Create a new menu item object
            const newDocument = new menusModel({
                name: name,
                allergenInfo: allergenInfo,
                price: newPrice
            });

            addDocumentToCollection(res, newDocument);
        }
        else
        {
            // TODO: Provide more informative error messages
            res.status(201).json({ message: "Invalid entry" }); 
        }
});

// Route to add a new recipe to the recipe collection
app.post('/recipes', async (req, res) => {

    // Extracting food name, allergy info, and recipe from the request body
    const { name, allergenInfo, recipe } = req.body;

    // Checks if the submitted data is valid
    if(stringNotEmpty(name) > 0 && stringNotEmpty(allergenInfo) > 0 && stringNotEmpty(recipe.length))
    {
        // Create a new recipe object
        const newDocument = new recipesModel({
            name: name,
            allergenInfo: allergenInfo,
            recipe: recipe
        });

        addDocumentToCollection(res, newDocument);
    }
    else
    {
        // TODO: Provide more informative error messages
        res.status(201).json({ message: "Invalid entry" }); 
    }
});


// PUT Methods

// Route to update the food pantry document in the misc collection
app.put('/food_pantry', async (req, res) => {

    let newInformation = req.body.information;

    if(stringNotEmpty(newInformation))
    {
        let document = await findDocumentInCollection(miscModel, "documentName", foodPantryDocumentName);
        updateSingleValueOfDocument(res, document, "information", newInformation);
    }
    else
    {
        res.status(201).json({ message: "Information can not be empty" }); 
    }
    
});


// Other Methods

// Function to find and send all documents from a given collection
async function getAndSendAllDocumentsInCollection(res, model)
{
    try 
    {
        const resultingDocuments = await model.find({});
        console.log(resultingDocuments);
        res.json(resultingDocuments);
    } 
    catch (error) 
    {
        res.status(500).json({ message: error.message });
    }
}

// Function to find and send documents from a given collection
async function getAndSendSpecificDocument(res, model, selectedDocumentName)
{
    try 
    {
        // Query to find document with the selectedDocumentName
        const resultingDocument = await model.findOne({ documentName: selectedDocumentName });
        
        if (!resultingDocument) 
        {
            return res.status(404).json({ message: "Sorry, this information could not be found" });
        }

        console.log(resultingDocument);
        res.json(resultingDocument);
    } 
    catch (error) 
    {
        res.status(500).json({ message: error.message });
    }
}

// Adds a document to a collection and sends a response to the client with the result of the attempt
async function addDocumentToCollection(res, newDocument)
{
    try 
    {
        const document = await newDocument.save();

        console.log(document);
        res.status(201).json(document); // Return the newly created document as JSON response
    } 
    catch (error) 
    {
        res.status(400).json({ message: error.message }); // If there is an error, return error message
    }
}

// Function to validate price
function isValidPrice(price)
{
    // Check if price is a valid number and greater than or equal to 0
    return !isNaN(parseFloat(price)) && isFinite(price) && Number(price) >= 0;
}

function stringNotEmpty(string)
{
    return string.length > 0;
}

async function findDocumentInCollection(model, key, value)
{
     // Create an object with the key variable as the property name
     let query = {};
     query[key] = value;
 
     try 
     {
         // Find the document by documentName
         const document = await model.findOne(query);
         
         if (!document) 
         {
             return res.status(404).json({ message: "Document not found" });
         }

         return document;
     } 
     catch (error) 
     {
         res.status(500).json({ message: error.message });
     }
}

async function updateSingleValueOfDocument(res, documentToUpdate, keyOfValueToUpdate, newValue)
{
    try 
    {
        // Update the information
        documentToUpdate[keyOfValueToUpdate] = newValue;
        await documentToUpdate.save();

        console.log("Document updated:", documentToUpdate);
        res.status(200).json({ message: "Document updated successfully" });
    } 
    catch (error) 
    {
        res.status(500).json({ message: error.message });
    }
}


// Listen on the selected port
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})