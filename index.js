const express = require('express');
const app = express();
const admin = require("firebase-admin");
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000;





const serviceAccount = require("./e-tuition-bd-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


app.use(cors())
app.use(express.json())

const verifyFirebaseToken = async(req, res, next)=>{

    const authorization = req.headers.authorization;
    if(!authorization){
        return res.status(401).send({message:'Unauthorized access'})
    }

    const token = authorization.split(' ')[1]
const decoded = await admin.auth().verifyIdToken(token)
req.decoded_email = decoded.email


next()
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.sc7dsau.mongodb.net/?appName=Cluster0`;
// const uri = `mongodb+srv://tuitions-db:TktvuxLD589PjxrZ@cluster0.sc7dsau.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run(){
try{

await client.connect();


const db = client.db('tuitions-db'); 
const tuitionsCollections = db.collection('tuitions'); 
const tutorCollections = db.collection('tutors')
const usersCollections = db.collection('users')

// user related apis 
app.post('/users',async(req, res)=>{
    const user = req.body;
    if(!user?.email || !user?.role){
    res.status(401).send({message:'Email and role are requered'})
    }
    const email = user?.email;
    const query = {email}
    const existedUser = await usersCollections.findOne(query)
    if(existedUser){
        return res.send({message: 'user already exited'})
    }
    const result = await usersCollections.insertOne(user)
    res.send(result)
})

app.get('/users', verifyFirebaseToken, async(req, res)=>{
    const result =await usersCollections.find().toArray();
    res.send(result)
})

app.get('/users/:email/role',verifyFirebaseToken,async (req, res)=>{
    const email = req.params.email;
    const query = {email}
const user = await usersCollections.findOne(query)
res.send({role:user?.role})
})

// tuition related apis 
app.post('/tuitions',async(req,res)=>{
    const tuitions = req.body;
    tuitions.status= 'pending'
    tuitions.createdAt= new Date();
    const result = await tuitionsCollections.insertOne(tuitions)
    res.send(result)
})

app.get('/tuitions', async (req, res)=>{
const {limit,email} =  req.query
console.log('hello', email)

if(email){
    const result = await tuitionsCollections.find({email:email}).sort({createdAt:-1}).toArray();
    console.log('result', result)
    return  res.send(result)
}

if(!limit){
    const page = parseInt(req.query.page) || 1
    const limit = 6;
    const skip = (page-1)*limit
    const total = await tuitionsCollections.countDocuments();

    const result = await tuitionsCollections.find().skip(skip).limit(limit).toArray();
    return  res.send({tuitions:result, page, totalPages:Math.ceil(total/limit)})
}

    if(!email && limit){
const result = await tuitionsCollections.find().sort({date:-1}).limit(8).toArray()
     res.send(result)
    }
    
})

// app.get('/tuitions', async(req, res)=>{
//     const email = req.query.email;
//     const query = {}
//     if(email){
//         query.email = email;
       
//     }
//      const result = await tuitionsCollections.find(query).sort({createdAt:-1}).toArray();
//      res.send(result)
// })

app.get('/tutors', async(req, res)=>{
    
    const {limit} = req.query;
    if(!limit){

            const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page-1) *limit
    const total = await tutorCollections.countDocuments();
    const result = await tutorCollections.find().skip(skip).limit(limit).toArray();
    res.send({tutors:result, page, totalPages:Math.ceil(total/limit)})

    }




    const cursor = tutorCollections.find().sort({rating:-1}).limit(8);
    const result = await cursor.toArray()
    res.send(result)
})


await client.db('admin').command({ping:1})
console.log("Pinged your deployment. You successfully connected to MongoDB!");


}
finally{
// await client.close();
}
}
run().catch(console.dir)


app.get('/',(req,res)=>{
    res.send('Hello World')
})


app.listen(port,()=>{
    console.log(`e tuition bd server running successfully`)
})