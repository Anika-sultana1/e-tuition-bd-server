const express = require('express');
const app = express();
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 3000;

app.use(cors())
app.use(express.json())

// tuitions-db
// TktvuxLD589PjxrZ

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.sc7dsau.mongodb.net/?appName=Cluster0`;
const uri = `mongodb+srv://tuitions-db:TktvuxLD589PjxrZ@cluster0.sc7dsau.mongodb.net/?appName=Cluster0`;

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

app.get('/tuitions', async (req, res)=>{
const {limit} =  req.query

if(!limit){
    const result = await tuitionsCollections.find().toArray();
    res.send(result)
}

    
    const result = await tuitionsCollections.find().sort({date:-1}).limit(8).toArray()
    res.send(result)
})

app.get('/tutors', async(req, res)=>{
    
    const {limit} = req.query;
    if(!limit){
        const result = await tutorCollections.find().toArray();
        res.send(result)
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