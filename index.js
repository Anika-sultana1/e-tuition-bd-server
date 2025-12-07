const express = require('express');
const app = express();
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000;

app.use(cors())
app.use(express.json())

// tuitions-db
// TktvuxLD589PjxrZ

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

app.get('/users', async(req, res)=>{
    const result =await usersCollections.find().toArray();
    res.send(result)
})


// tuition related apis 
app.get('/tuitions', async (req, res)=>{
const {limit} =  req.query

if(!limit){
    const page = parseInt(req.query.page) || 1
    const limit = 6;
    const skip = (page-1)*limit
    const total = await tutorCollections.countDocuments();

    const result = await tuitionsCollections.find().skip(skip).limit(limit).toArray();
    res.send({tuitions:result, page, totalPages:Math.ceil(total/limit)})
}

    
    const result = await tuitionsCollections.find().sort({date:-1}).limit(8).toArray()
    res.send(result)
})

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