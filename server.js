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
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Use body-parser for POST method
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// URI to connect to the MongoDB cloud database
const mongoDbURI = "" // Paste URI inside quotation marks

// MongoDB connection
mongoose.connect(mongoDbURI)
    .then(() => {
        console.log('MongoDB connected successfully');
    })
    .catch((error) => {
        console.error('MongoDB connection error:', error);
    });

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));


// Define schemas for MongoDB collections

// Schema for menuItems
const menuItemsSchema = new mongoose.Schema({
    name: String,
	description: String,
	price: Number,
	ingredients: String,
    allergens: String
});

// Schema for recipes
const recipesSchema = new mongoose.Schema({
    title: String,
    description: String,
    image: String,
    allergens: String,
    file: String
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

// Schema for item (from the menu collection)
const itemSchema = new mongoose.Schema({
    menuItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'menuItems' // Reference to the menuItems collection
    }
});

// Schema for menu
const menuSchema = new mongoose.Schema({
    day: String,
    items: [itemSchema]
});

// Create models based on schemas
const menuItemsModel = mongoose.model('menuItems', menuItemsSchema, 'menuItems'); // Model for menuItems
const recipesModel = mongoose.model('recipes', recipesSchema); // Model for recipes
const miscModel = mongoose.model('misc', miscSchema, 'misc'); // Model for misc
const openingHoursModel = mongoose.model('openingHours', openingHoursSchema, 'openingHours'); // Model for openingHours
const menuModel = mongoose.model('menu', menuSchema, 'menu'); // Model for menu

let foodPantryDocumentName = "FoodPantry";


// GET Methods

// Route to get all of the menu items from the menu items collection of the database and sends them as a response to the client.
app.get('/menu_items', async (req, res) => {

    respondToClient(res, await getAllDocumentsInCollection(menuItemsModel));
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

// Route to get all of the weekly menu items from the menu collection of the database and send them as a response to the client.
app.get('/menu', async (req, res) => {

    try 
    {
        const weeklyMenus = await menuModel.find({}).populate('items.menuItemId'); // Populate the menuItemId field in the items array

        // Filter out items items where menuItems doesn't exist in the menuItems collection
        weeklyMenus.forEach(menu => {
            menu.items = menu.items.filter(item => item.menuItemId);
        });

        console.log(weeklyMenus);

        // Send the populated weeklyMenus array as a response to the client
        respondToClient(res, createResponseForClient(200, weeklyMenus));
    } 
    catch (error) 
    {
        console.error(error);
        respondToClient(res, createResponseForClient(500, "Internal Server Error"));
    }
});



// POST Methods

// Route to add a new menu item to the menuItem collection
app.post('/menu_items', async (req, res) => {

        // Extracting information from the request body
        const { name, description, price, ingredients, allergens } = req.body;

        // Checks if the submitted data is valid
        if(stringNotEmpty(name) && stringNotEmpty(description) && stringNotEmpty(ingredients) && stringNotEmpty(allergens) && isValidPrice(price))
        {
            let newPrice = Number(price).toFixed(2); // Ensures that there are not more than two numbers after the decimal point

            // Create a new menu item object
            const newDocument = new menuItemsModel({
                name: name,
                description: description,
                price: newPrice,
                ingredients: ingredients,
                allergens: allergens
            });

            respondToClient(res, await addDocumentToCollection(newDocument));
        }
        else
        {
            // TODO: Provide more informative error messages
            respondToClient(res, createResponseForClient(400, "Invalid entry"));
        }
});

// Route to add a new recipe to the recipe collection
app.post('/recipes', async (req, res) => {

    // Extracting information from the request body
    const { title, description, image, allergens, file } = req.body;

    // Checks if the submitted data is valid
    if(stringNotEmpty(title) && stringNotEmpty(description) && stringNotEmpty(image) && stringNotEmpty(allergens) && stringNotEmpty(file))
    {
        // Create a new recipe object
        const newDocument = new recipesModel({
            title: title,
            description: description,
            image: image,
            allergens: allergens,
            file: file
        });

        let responseForClient = await addDocumentToCollection(newDocument);
        respondToClient(res, responseForClient);
    }
    else
    {
        // TODO: Provide more informative error messages
        respondToClient(res, createResponseForClient(400, "Invalid entry"));
    }
});


// PUT Methods

// Route to update the food pantry document in the misc collection
app.put('/food_pantry', async (req, res) => {

    // Extracting information from the request body
    let newInformation = req.body.information;

    // Check if the string from the request body are empty
    if(stringNotEmpty(newInformation))
    {
        let result = await findDocumentInCollection(miscModel, "documentName", foodPantryDocumentName); // Attempt to find the document in the misc collection

        if(!(result instanceof Array)) // If the document was found
        {
            // Update the document and send a response to the client
            respondToClient(res, await updateSingleValueOfDocument(result, "information", newInformation));
        }
        else // If the document was not found
        {
            respondToClient(res, result); // Send error message as a response to the client
        }
    }
    else
    {
        respondToClient(res, createResponseForClient(400, "Information can not be empty"));
    }
});

// Route to update the opening hours for a day in the opening hours collection
app.put('/opening_hours', async (req, res) => {

    // Extracting day, opening time, and closing time from the request body
    const { day, openingTime, closingTime } = req.body;

    // Check if any of the strings from the request body are empty
    if(stringNotEmpty(day) && stringNotEmpty(openingTime) && stringNotEmpty(closingTime))
    {
        let result = await findDocumentInCollection(openingHoursModel, "day", day); // Attempt to find the document in the openingHours collection

        if(!(result instanceof Array)) // If the document was found
        {
            openingTimeStatusCode = (await updateSingleValueOfDocument(result, "openingTime", openingTime))[0]; // Get status code of the result of updating the openingTime
            closingTimeStatusCode = (await updateSingleValueOfDocument(result, "closingTime", closingTime))[0]; // Get status code of the result of updating the closingTime

            if(openingTimeStatusCode == 200 && closingTimeStatusCode == 200) // Ensure that both the status codes are 200 (both documents updated successfully)
            {
                respondToClient(res, createResponseForClient(200, "Successfully updated opening time")); // Send success message as a response to the client
            }
        }
        else // If the document was not found
        {
            respondToClient(res, result); // Send error message as a response to the client
        }
    }
    else
    {
        respondToClient(res, createResponseForClient(400, "Information can not be empty"));
    }  
});

// Route to add a menu item from the menuItems collection to a specific day in the menu collection
app.put('/menu', async (req, res) => {

    try 
    {
        // Extracting day and menuItemId from the request body
        const { day, menuItemId } = req.body;

        // Check if day and menuItemId are provided
        if (!stringNotEmpty(day) || !menuItemId) 
        {
            return respondToClient(res, createResponseForClient(400, "Missing day or menuItemId"));
        }

        // Check if menuItemId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(menuItemId)) 
        {
            return respondToClient(res, createResponseForClient(400, "Invalid menuItemId"));
        }

        // Attempt to find document with an _id of menuItemId in menuItems collection
        const menuItems = await findDocumentInCollection(menuItemsModel, "_id", menuItemId);

        // If menuItems was not found
        if(menuItems instanceof Array)
        {
            return respondToClient(res, createResponseForClient(404, "menuItemId does not exist"));
        }

        const menu = await menuModel.findOne({ day }); // Find the menu document based on the day

        // Check if the menu document exists
        if (!menu) 
        {
            // Send a 404 response if the document is not found
            return respondToClient(res, createResponseForClient(404, "Menu not found for the provided day"));
        }

        menu.items.push({ menuItemId }); // Add menuItemId to the items array

        await menu.save(); // Save the updated menu document

        respondToClient(res, createResponseForClient(200, "Weekly menu updated successfully")); // Send success response
    } 
    catch (error) 
    {
        console.error(error);
        respondToClient(res, createResponseForClient(500, "Internal Server Error")); // Send error response
    }
});


// DELETE Methods



// Other Methods

// Function to find all documents from a given collection
async function getAllDocumentsInCollection(model)
{
    try 
    {
        const resultingDocuments = await model.find({}); // Find all documents in the given collection
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