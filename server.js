const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
var fs = require('fs');
var path = require('path');
const multer = require('multer');
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
const mongoDbURI = ""; // Paste URI inside quotation marks

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

// Storage location for file uploads - Recipe PDFs
const storage = multer.diskStorage ({
    destination: (req, file, cb) => { //Define the destination folder
        cb(null, 'uploads/')
    },
    filename: (req, file, cb) => {
        const newId = new mongoose.Types.ObjectId(); //Creates an ObjectID for the recipe object to use.
        cb(null, newId+".pdf") //Define the filename to save
    }
})
const multerUpload = multer({storage})

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
    allergens: String
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

// Schema for passwords
const passwordsSchema = new mongoose.Schema({
    username: String,
    hashedPassword: String
});

// Create models based on schemas
const menuItemsModel = mongoose.model('menuItems', menuItemsSchema, 'menuItems'); // Model for menuItems
const recipesModel = mongoose.model('recipes', recipesSchema); // Model for recipes
const miscModel = mongoose.model('misc', miscSchema, 'misc'); // Model for misc
const openingHoursModel = mongoose.model('openingHours', openingHoursSchema, 'openingHours'); // Model for openingHours
const menuModel = mongoose.model('menu', menuSchema, 'menu'); // Model for menu
const passwordsModel = mongoose.model('passwords', passwordsSchema, 'passwords'); // Model for passwords

const HTTP_STATUS_CODE_OK = 200;
const HTTP_STATUS_CODE_CREATED = 201;
const HTTP_STATUS_CODE_BAD_REQUEST = 400;
const HTTP_STATUS_CODE_UNAUTHORIZED = 401;
const HTTP_STATUS_CODE_FORBIDDEN = 403;
const HTTP_STATUS_CODE_NOT_FOUND = 404;
const HTTP_STATUS_CODE_INTERNAL_SERVER_ERROR = 500;
const foodPantryDocumentName = "FoodPantry";


// GET Methods

// Route to get all of the menu items from the menu items collection of the database and sends them as a response to the client.
app.get('/menu_items', verifyToken, async (req, res) => {

    console.log("Menu Items");
    respondToClient(res, await getAllDocumentsInCollection(menuItemsModel));
});

// Route to get a specific menuItem from the menuItems collection based on its object id
app.get('/menu_items/:id', async (req, res) => {

    respondToClient(res, await findDocumentInCollection(menuItemsModel, "_id", req.params.id));
});

// Route to get all of the recipes from the recipe collection of the database and sends them as a response to the client.
app.get('/recipes', async (req, res) => {

    respondToClient(res, await getAllDocumentsInCollection(recipesModel));
});

// Route to get a specific recipe from the recipes collection based on its object id
app.get('/recipes/:id', async (req, res) => {

    respondToClient(res, await findDocumentInCollection(recipesModel, "_id", req.params.id));
});

// Download a specific recipe if it exists.
app.get('/recipes/download/:id', async(req,res) => {
    const file = __dirname+'/uploads/'+req.params.id+'.pdf'; //Path to recipe
    fs.access(file, fs.constants.F_OK, (err) => { //Check if file exists
        if(err) {
            res.send(err)
        }
        else {
            res.download(file); // Download if it does
        }
    })
})

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

        // Filter out items where menuItemId doesn't exist in the menuItems collection
        weeklyMenus.forEach(menu => {
            menu.items = menu.items.filter(item => item.menuItemId);
        });

        console.log(weeklyMenus);

        // Send the populated weeklyMenus array as a response to the client
        respondToClient(res, createResponseForClient(HTTP_STATUS_CODE_OK, weeklyMenus));
    } 
    catch (error) 
    {
        console.error(error);
        respondToClient(res, createResponseForClient(HTTP_STATUS_CODE_INTERNAL_SERVER_ERROR, "Internal Server Error"));
    }
});

// Route to get a specific menu from the menu collection based on a given day
app.get('/menu/:day', async (req, res) => {

    try 
    {
        const result = await findDocumentInCollection(menuModel, "day", req.params.day); // Find document in collection

        // Return error if document not found
        if(result[0] != HTTP_STATUS_CODE_OK)
        {
            return result;
        }
        else
        {
            const dailyMenu = await menuModel.find({day: req.params.day}).populate('items.menuItemId'); // Populate the menuItemId field in the items array

            // Filter out items where menuItemId doesn't exist in the menuItems collection
            dailyMenu.forEach(menu => {
                menu.items = menu.items.filter(item => item.menuItemId);
            });

            console.log(dailyMenu);

            // Send the populated weeklyMenus array as a response to the client
            respondToClient(res, createResponseForClient(HTTP_STATUS_CODE_OK, dailyMenu));
        }
    } 
    catch (error) 
    {
        console.error(error);
        respondToClient(res, createResponseForClient(HTTP_STATUS_CODE_INTERNAL_SERVER_ERROR, "Internal Server Error"));
    }
});



// POST Methods

// Route to add a new menu item to the menuItem collection
app.post('/menu_items', verifyToken, async (req, res) => {

    const result = createMenuItemObject(req.body, false);

    // Return error if document not found
    if(result[0] != HTTP_STATUS_CODE_OK)
    {
        respondToClient(res, result);
    }
    else
    {
        newDocument = result[1];

        respondToClient(res, await addDocumentToCollection(newDocument));
    }
});

// Route to add a new recipe to the recipe collection
// multerUpload.single() uploads the file to the /uploads folder.
app.post('/recipes', verifyToken, multerUpload.single('file'), async (req, res) => {

    const file = req.file;
    const id = file.filename.replace('.pdf', '');
    // Extracting information from the request body - Req.Body contains the text fields, everything except file.
    const { title, description, allergens } = req.body;

    // Checks if the submitted data is valid
    if(stringNotEmpty(title) && stringNotEmpty(description)  && stringNotEmpty(allergens) && file != null)
    {
        // Create a new recipe object
        const newDocument = new recipesModel({
            _id: new mongoose.Types.ObjectId(id),
            title: title,
            description: description,
            allergens: allergens
        });

        let responseForClient = await addDocumentToCollection(newDocument);

        respondToClient(res, responseForClient);
    }
    else
    {
        // TODO: Provide more informative error messages
        respondToClient(res, createResponseForClient(HTTP_STATUS_CODE_BAD_REQUEST, "Invalid entry"));
    }
});


// Route for user login
app.post('/login', async (req, res) => 
{
    // Extract username and password from request body
    const { username, password } = req.body;

    // Validate if both username and password are provided
    if (username && password) 
    {
        // Return the result of the login attempt to the client (token if successful, error message if not successful)
        respondToClient(res, await manageLogin(username, password));
    } 
    else 
    {
        // If either username or password is missing, respond with a 400 Bad Request status and a message indicating that both username and password are required
        respondToClient(res, createResponseForClient(HTTP_STATUS_CODE_BAD_REQUEST, "Username and password are required"));
    }
});



// PUT Methods

// Route to update a specific menuItem from the menuItems collection based on its object id
app.put('/menu_items/:id', verifyToken, async (req, res) => {

    const result = createMenuItemObject(req.body, true);

    // Return error if document not found
    if(result[0] != HTTP_STATUS_CODE_OK)
    {
        respondToClient(res, result);
    }
    else
    {
        newDocument = result[1];

        respondToClient(res, await updateDocumentById(menuItemsModel, req.params.id, newDocument));
    }
});

// Route to update the food pantry document in the misc collection
app.put('/food_pantry', verifyToken, async (req, res) => {

    // Extracting information from the request body
    let newInformation = req.body.information;

    // Check if the string from the request body are empty
    if(stringNotEmpty(newInformation))
    {
        let result = await findDocumentInCollection(miscModel, "documentName", foodPantryDocumentName); // Attempt to find the document in the misc collection

        if(result[0] == HTTP_STATUS_CODE_OK) // If the document was found
        {
            // Update the document and send a response to the client
            respondToClient(res, await updateSingleValueOfDocument(result[1], "information", newInformation));
        }
        else // If the document was not found
        {
            respondToClient(res, result); // Send error message as a response to the client
        }
    }
    else
    {
        respondToClient(res, createResponseForClient(HTTP_STATUS_CODE_BAD_REQUEST, "Information can not be empty"));
    }
});

// Route to update the opening hours for a day in the opening hours collection
app.put('/opening_hours', verifyToken, async (req, res) => {

    // Extracting day, opening time, and closing time from the request body
    const { day, openingTime, closingTime } = req.body;

    // Check if any of the strings from the request body are empty
    if(stringNotEmpty(day) && stringNotEmpty(openingTime) && stringNotEmpty(closingTime))
    {
        let result = await findDocumentInCollection(openingHoursModel, "day", day); // Attempt to find the document in the openingHours collection

        if(result[0] == HTTP_STATUS_CODE_OK) // If the document was found
        {
            let document = result[1];
            openingTimeStatusCode = (await updateSingleValueOfDocument(document, "openingTime", openingTime))[0]; // Get status code of the result of updating the openingTime
            closingTimeStatusCode = (await updateSingleValueOfDocument(document, "closingTime", closingTime))[0]; // Get status code of the result of updating the closingTime

            if(openingTimeStatusCode == HTTP_STATUS_CODE_OK && closingTimeStatusCode == HTTP_STATUS_CODE_OK) // Ensure that both the status codes are HTTP_STATUS_CODE_OK (both documents updated successfully)
            {
                respondToClient(res, createResponseForClient(HTTP_STATUS_CODE_OK, "Successfully updated opening time")); // Send success message as a response to the client
            }
        }
        else // If the document was not found
        {
            respondToClient(res, result); // Send error message as a response to the client
        }
    }
    else
    {
        respondToClient(res, createResponseForClient(HTTP_STATUS_CODE_BAD_REQUEST, "Information can not be empty"));
    }
});

// Route to add a menu item from the menuItems collection to a specific day in the menu collection
app.put('/menu/:day/:menuItemId', verifyToken, async (req, res) => {

    try 
    {
        // Extracting day and menuItemId from the request parameters
        const { day, menuItemId } = req.params;

        // Attempt to find document with an _id of menuItemId in menuItems collection
        const menuItems = await findDocumentInCollection(menuItemsModel, "_id", menuItemId);

        // If menuItems was not found
        if(menuItems[0] != HTTP_STATUS_CODE_OK)
        {
            return respondToClient(res, createResponseForClient(HTTP_STATUS_CODE_NOT_FOUND, "menuItemId does not exist"));
        }

        const menu = await menuModel.findOne({ day }); // Find the menu document based on the day

        // Check if the menu document exists
        if (!menu) 
        {
            // Send a HTTP_STATUS_CODE_NOT_FOUND response if the document is not found
            return respondToClient(res, createResponseForClient(HTTP_STATUS_CODE_NOT_FOUND, "Menu not found for the provided day"));
        }

        menu.items.push({ menuItemId }); // Add menuItemId to the items array

        await menu.save(); // Save the updated menu document

        respondToClient(res, createResponseForClient(HTTP_STATUS_CODE_OK, "Weekly menu updated successfully")); // Send success response
    } 
    catch (error) 
    {
        console.error(error);
        respondToClient(res, createResponseForClient(HTTP_STATUS_CODE_INTERNAL_SERVER_ERROR, "Internal Server Error")); // Send error response
    }
});

// Route for updating user's password
app.put('/update_password', verifyToken, async (req, res) => {

    // Extract username, old password, and new password from request body
    const { username, oldPassword, newPassword } = req.body;

    // Validate if all required fields are provided
    if (username && oldPassword && newPassword) 
    {
        try 
        {
            // Find the user based on the username
            const userSearchResult = await findDocumentInCollection(passwordsModel, "username", username);

            if (userSearchResult[0] == HTTP_STATUS_CODE_OK) 
            {
                // If user found, compare old password with the hashed password in the database
                const user = userSearchResult[1];
                const hashedPassword = user.hashedPassword;

                // Compare old password with hashed password
                const match = await comparePasswords(oldPassword, hashedPassword);

                if (match[0] == HTTP_STATUS_CODE_OK) 
                {
                    // If old password matches, hash the new password
                    const newHashedPassword = await hashPassword(newPassword);

                    // Update the user's password in the database and send response indicating success or failure
                    respondToClient(res, await updateSingleValueOfDocument(user, "hashedPassword", newHashedPassword));
                } 
                else 
                {
                    // If old password doesn't match, respond with an error message
                    respondToClient(res, createResponseForClient(HTTP_STATUS_CODE_UNAUTHORIZED, "Old password is incorrect"));
                }
            } 
            else 
            {
                // If user not found, respond with an error message
                respondToClient(res, createResponseForClient(HTTP_STATUS_CODE_NOT_FOUND, "User not found"));
            }
        } 
        catch (error) 
        {
            // Handle any potential errors and respond with an error message
            console.error(error);
            respondToClient(res, createResponseForClient(HTTP_STATUS_CODE_INTERNAL_SERVER_ERROR, "Internal Server Error"));
        }
    } 
    else 
    {
        // If any required field is missing, respond with an error message
        respondToClient(res, createResponseForClient(HTTP_STATUS_CODE_BAD_REQUEST, "Old password and new password are required"));
    }
});



// DELETE Methods

// Route to delete a specific menuItem from the menuItems collection based on its object id
app.delete('/menu_items/:id', verifyToken, async (req, res) => {

    await deleteMenuItem(res, req);
});

// Route to delete a menu item from the menuItems collection to a specific day in the menu collection
app.delete('/menu/:day/:menuItemId', verifyToken, async (req, res) => {

    await removeMenuItemFromDay(res, req);
});


// Other Methods

// Function to find all documents from a given collection
async function getAllDocumentsInCollection(model)
{
    try 
    {
        const resultingDocuments = await model.find({}); // Find all documents in the given collection
        console.log(resultingDocuments);

        return createResponseForClient(HTTP_STATUS_CODE_CREATED, resultingDocuments); // Return success response
    } 
    catch (error) 
    {
        return createResponseForClient(HTTP_STATUS_CODE_INTERNAL_SERVER_ERROR, error.message); // Return error response if an error occurs
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
            return createResponseForClient(HTTP_STATUS_CODE_INTERNAL_SERVER_ERROR, "Sorry, this information could not be found"); 
        }

        console.log(resultingDocument);

        return createResponseForClient(HTTP_STATUS_CODE_CREATED, resultingDocument); // Return success response
    } 
    catch (error) 
    {
        return createResponseForClient(HTTP_STATUS_CODE_INTERNAL_SERVER_ERROR, error.message); // Return error response if an error occurs
    }
}

// Adds a document to a collection and sends a response to the client with the result of the attempt
async function addDocumentToCollection(newDocument)
{
    try 
    {
        const document = await newDocument.save();
        console.log(document);

        return createResponseForClient(HTTP_STATUS_CODE_CREATED, "Added Document"); // Return success response
    } 
    catch (error) 
    {
        return createResponseForClient(HTTP_STATUS_CODE_INTERNAL_SERVER_ERROR, error.message); // Return error response if an error occurs
    }
}

// Deletes a document from a given collection based on its object id
async function deleteDocumentById(model, id)
{
    try 
    {
        const result = await findDocumentInCollection(model, "_id", id); // Find document in collection

        // Return error if document not found
        if(result[0] != HTTP_STATUS_CODE_OK)
        {
            return result;
        }

        await model.findByIdAndDelete(id); // Find document by the object id and delete it

        return createResponseForClient(HTTP_STATUS_CODE_OK, "Document deleted"); // Return success response
    } 
    catch (error) 
    {
        console.log(error.message);
        return createResponseForClient(HTTP_STATUS_CODE_INTERNAL_SERVER_ERROR, error.message); // Return error response if an error occurs
    }
}

// Updates a document in a given collection based on its object id
async function updateDocumentById(model, id, newDocument)
{
    try 
    {
        const result = await findDocumentInCollection(model, "_id", id); // Find document in collection

        // Return error if document not found
        if(result[0] != HTTP_STATUS_CODE_OK)
        {
            return result;
        }

        const updatedDocument = await model.findByIdAndUpdate(id, newDocument, { new: true });

        return createResponseForClient(HTTP_STATUS_CODE_OK, updatedDocument); // Return success response
    } 
    catch (error) 
    {
        console.log(error.message);
        return createResponseForClient(HTTP_STATUS_CODE_INTERNAL_SERVER_ERROR, error.message); // Return error response if an error occurs
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
             return createResponseForClient(HTTP_STATUS_CODE_NOT_FOUND, "Document not found"); // Return error response if document not found
         }

         return createResponseForClient(HTTP_STATUS_CODE_OK, document);
     } 
     catch (error) 
     {
        return createResponseForClient(HTTP_STATUS_CODE_INTERNAL_SERVER_ERROR, error.message); // Return error response if an error occurs
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

        return createResponseForClient(HTTP_STATUS_CODE_OK, "Document updated successfully"); // Return success response
    } 
    catch (error) 
    {
        return createResponseForClient(HTTP_STATUS_CODE_INTERNAL_SERVER_ERROR, error.message); // Return error response if an error occurs
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

// Create or edit a menu item object
function createMenuItemObject(requestBody, edit)
{
    // Extracting information from the request body
    const { name, description, price, ingredients, allergens } = requestBody;

    // Checks if the submitted data is valid
    if(stringNotEmpty(name) && stringNotEmpty(description) && stringNotEmpty(ingredients) && stringNotEmpty(allergens) && isValidPrice(price))
    {
        let newPrice = Number(price).toFixed(2); // Ensures that there are not more than two numbers after the decimal point
        
        // Create a new menu item object
        let newDocument = {
            name: name,
            description: description,
            price: newPrice,
            ingredients: ingredients,
            allergens: allergens
        };

        if(!edit)
        {
            // Create a new menu item document
            newDocument = new menuItemsModel(newDocument);
        }

        return createResponseForClient(HTTP_STATUS_CODE_OK, newDocument);
    }
    else
    {
        // TODO: Provide more informative error messages
        return createResponseForClient(HTTP_STATUS_CODE_BAD_REQUEST, "Invalid entry");
    }
}

// Function to delete a specific menuItem from the menuItems collection based on its object id
async function deleteMenuItem(res, req)
{
    respondToClient(res, await deleteDocumentById(menuItemsModel, req.params.id));
}

// Function to delete a menuItem from a specific day in the menus collection
async function removeMenuItemFromDay(res, req)
{
    // Extracting day and menuItemId from the request parameters
    const { day, menuItemId } = req.params;

    try 
    {
        // Find the menu for the given day
        const menu = await menuModel.findOne({ day });

        if (!menu) 
        {
            // Send a HTTP_STATUS_CODE_NOT_FOUND response if the document is not found
            return respondToClient(res, createResponseForClient(HTTP_STATUS_CODE_NOT_FOUND, "Menu not found for the provided day"));
        }

        // Filter out the item with the given menuItemId
        menu.items = menu.items.filter(item => {
            return item.menuItemId.toString() !== menuItemId.toString();
        });

        // Save the updated document
        await menu.save();

        respondToClient(res, createResponseForClient(HTTP_STATUS_CODE_OK, "Weekly menu updated successfully")); // Send success response
    } 
    catch (error) 
    {
        console.error(error);
        respondToClient(res, createResponseForClient(HTTP_STATUS_CODE_INTERNAL_SERVER_ERROR, "Internal Server Error")); // Send error response
    }
}

// Function to generate JWT token for a given user
async function generateToken(user) 
{
    const tokenKey = await getTokenKey(); // Retrieve the token key from the database
    
    // Sign the token using jwt.sign with user's ID, token key, and expiration time of 1 hour
    const token = jwt.sign({ id: user._id }, tokenKey, { expiresIn: '1h' });
    
    return token; // Return the generated token
}

// Middleware function to verify JWT token in incoming requests
async function verifyToken(req, res, next) 
{
    const token = req.headers['authorization']; // Extract token from request headers
    
    const tokenKey = await getTokenKey(); // Retrieve the token key asynchronously

    // If no token is provided in the request headers
    if (!token) 
    {
        console.log("No token provided");

        // Return a 403 Forbidden status with a JSON response indicating no token provided
        return res.status(HTTP_STATUS_CODE_FORBIDDEN).json({ message: 'No token provided' });
    }

    // Verify the token using jwt.verify
    jwt.verify(token, tokenKey, (err, decoded) => {

        // If there's an error in verification
        if (err) 
        {
            console.log("Failed to authenticate token", err);

            // Return a 401 Unauthorized status with a JSON response indicating failed authentication
            return res.status(HTTP_STATUS_CODE_UNAUTHORIZED).json({ message: 'Failed to authenticate token' });
        }

        // If token is successfully verified, attach the decoded user ID to the request object
        req.userId = decoded.id;

        next(); // Call the next middleware function
    });
}

// Function to get the jwt token key from the misc collection of the database 
async function getTokenKey()
{
    const result = await findDocumentInCollection(miscModel, "documentName", "TokenKey");

    return result[1].information; // Return the token key
}

// Return hashed version of given plaintext password
async function hashPassword(password) 
{
    try 
    {
        // Generate a salt
        const salt = await bcrypt.genSalt(10);

        // Hash the password along with the salt
        const hashedPassword = await bcrypt.hash(password, salt);

        return hashedPassword;
    } 
    catch (error) 
    {
        throw new Error('Error hashing password');
    }
}

// Compare plaintext password with hashed password
async function comparePasswords(plainTextPassword, hashedPassword) 
{
    try 
    {
        // Compare the provided password with the hashed password from the database
        const match = await bcrypt.compare(plainTextPassword, hashedPassword);

        // Return match if the passwords matched
        if(match)
        {
            return createResponseForClient(HTTP_STATUS_CODE_OK, match);
        }

        return createResponseForClient(HTTP_STATUS_CODE_UNAUTHORIZED, "Invalid username or password"); // Return invalid message if passwords did not match
    } 
    catch (error) 
    {
        return createResponseForClient(HTTP_STATUS_CODE_UNAUTHORIZED, "Invalid username or password");
    }
}

// Function to manage a user logging in
async function manageLogin(username, password)
{
    // Attempt to find a user with the provided username and password combination
    const userSearchResult = await findDocumentInCollection(passwordsModel, "username", username);

    if (userSearchResult[0] == HTTP_STATUS_CODE_OK) // If a user is found with the provided credentials
    {
        user = userSearchResult[1]; // Set the user to the user document from the database
        const hashedPassword = user.hashedPassword; // Set the hashedPassword to the hashedPassword in the user document
        const match = await comparePasswords(password, hashedPassword); // Compare the password and the hashedPassword

        if(match[0] == HTTP_STATUS_CODE_OK) // If the password and the hashedPassword matched
        {
            const token = await generateToken(user); // Generate a JWT token for the authenticated user

            return createResponseForClient(HTTP_STATUS_CODE_OK, token); // Return the generated token
        }
    }

    // If no user is found with the provided credentials, or the password is incorrect, create a response with a 401 Unauthorized status and a message indicating invalid username or password
    return createResponseForClient(HTTP_STATUS_CODE_UNAUTHORIZED, "Invalid username or password");
}


// Listen on the selected port
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})