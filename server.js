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

// GET Methods

// Route to get all of the menu items from the menu collection of the database and sends them as a response to the client.
app.get('/menu', async (req, res) => {

    respondToClient(res, await getAllDocumentsInCollection(menusModel));
});

// Route to get all of the recipes from the recipe collection of the database and sends them as a response to the client.
app.get('/recipes', async (req, res) => {

    respondToClient(res, await getAllDocumentsInCollection(recipesModel));
});

// Route to get the food pantry information from the misc collection of the database and sends it as a response to the client.
app.get('/food_pantry', async (req, res) => {

    respondToClient(res, await getSpecificDocument(miscModel, foodPantryDocumentName));
});

// Route to get the opening hours from the openingHours collection of the database and sends it as a response to the client.
app.get('/opening_hours', async (req, res) => {

    respondToClient(res, await getAllDocumentsInCollection(openingHoursModel));
});


// POST Methods

// Route to add a new menu item to the menu collection
app.post('/menu', async (req, res) => {

        // Extracting food name, allergy info, and price from the request body
        const { name, allergenInfo, price } = req.body;

        // Checks if the submitted data is valid
        if(stringNotEmpty(name) && stringNotEmpty(allergenInfo) && isValidPrice(price))
        {
            let newPrice = Number(price).toFixed(2); // Ensures that there are not more than two numbers after the decimal point

            // Create a new menu item object
            const newDocument = new menusModel({
                name: name,
                allergenInfo: allergenInfo,
                price: newPrice
            });

            respondToClient(res, await addDocumentToCollection(newDocument));
        }
        else
        {
            // TODO: Provide more informative error messages
            respondToClient(res, createResponseForClient(200, "Invalid entry"));
        }
});

// Route to add a new recipe to the recipe collection
app.post('/recipes', async (req, res) => {

    // Extracting food name, allergy info, and recipe from the request body
    const { name, allergenInfo, recipe } = req.body;

    // Checks if the submitted data is valid
    if(stringNotEmpty(name) && stringNotEmpty(allergenInfo) && stringNotEmpty(recipe))
    {
        // Create a new recipe object
        const newDocument = new recipesModel({
            name: name,
            allergenInfo: allergenInfo,
            recipe: recipe
        });

        //addDocumentToCollection(newDocument);
        let responseForClient = await addDocumentToCollection(newDocument);
        respondToClient(res, responseForClient);
    }
    else
    {
        // TODO: Provide more informative error messages
        respondToClient(res, createResponseForClient(200, "Invalid entry"));
    }
});


// PUT Methods

// Route to update the food pantry document in the misc collection
app.put('/food_pantry', async (req, res) => {

    let newInformation = req.body.information;

    if(stringNotEmpty(newInformation))
    {
        let result = await findDocumentInCollection(miscModel, "documentName", foodPantryDocumentName);

        if(!(result instanceof Array))
        {
            respondToClient(res, await updateSingleValueOfDocument(result, "information", newInformation));
        }
        else
        {
            respondToClient(res, result);
        }
    }
    else
    {
        respondToClient(res, createResponseForClient(200, "Information can not be empty"));
    }
    
});


// Other Methods

// Function to find all documents from a given collection
async function getAllDocumentsInCollection(model)
{
    try 
    {
        const resultingDocuments = await model.find({});
        console.log(resultingDocuments);

        return createResponseForClient(201, resultingDocuments); // Return success response
    } 
    catch (error) 
    {
        return createResponseForClient(500, error.message); // Return error response if an error occurs
    }
}

// Function to find and send documents from a given collection
async function getSpecificDocument(model, selectedDocumentName)
{
    try 
    {
        // Query to find document with the selectedDocumentName
        const resultingDocument = await model.findOne({ documentName: selectedDocumentName });
        
        if (!resultingDocument) 
        {
            return createResponseForClient(500, "Sorry, this information could not be found"); 
        }

        console.log(resultingDocument);

        return createResponseForClient(201, resultingDocument); // Return success response
    } 
    catch (error) 
    {
        return createResponseForClient(500, error.message); // Return error response if an error occurs
    }
}

// Adds a document to a collection and sends a response to the client with the result of the attempt
async function addDocumentToCollection(newDocument)
{
    try 
    {
        const document = await newDocument.save();
        console.log(document);

        return createResponseForClient(201, "Added Document"); // Return success response
    } 
    catch (error) 
    {
        return createResponseForClient(500, error.message); // Return error response if an error occurs
    }
}

// Function to validate price
function isValidPrice(price)
{
    // Check if price is a valid number and greater than or equal to 0
    return !isNaN(parseFloat(price)) && isFinite(price) && Number(price) >= 0;
}

// Function to check if a string is not empty
function stringNotEmpty(string)
{
    return string.length > 0;
}

// Function to find a document in a given collection based on key-value pair
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
             return createResponseForClient(404, "Document not found"); // Return error response if document not found
         }

         return document; // Return found document
     } 
     catch (error) 
     {
        return createResponseForClient(500, error.message); // Return error response if an error occurs
     }
}

// Function to update a single value of a document in a collection
async function updateSingleValueOfDocument(documentToUpdate, keyOfValueToUpdate, newValue)
{
    try 
    {
        // Update the information
        documentToUpdate[keyOfValueToUpdate] = newValue;
        await documentToUpdate.save(); // Save updated document

        return createResponseForClient(200, "Document updated successfully"); // Return success response
    } 
    catch (error) 
    {
        return createResponseForClient(500, error.message); // Return error response if an error occurs
    }
}

// Function to send response to the client
function respondToClient(res, responseForClient)
{
    let statusCode = responseForClient[0];
    let responseMessage = responseForClient[1];

    res.status(statusCode).json(responseMessage); // Send response to client with status code and message
}

// Function to create response JSON object for the client
function createResponseForClient(statusCode, responseMessage)
{
    if(typeof responseMessage === "string")
    {
        responseMessage = { message: responseMessage }; // Wrap response message in JSON object if it's a string
    }

    return [statusCode, responseMessage]; // Return statusCode and responseMessage as an array
}


// Listen on the selected port
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})