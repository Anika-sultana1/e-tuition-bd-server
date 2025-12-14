const express = require('express');
require('dotenv').config()
const app = express();
const admin = require("firebase-admin");
const cors = require('cors')
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000;





const serviceAccount = require("./e-tuition-bd-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


app.use(cors());
app.use(express.json())

const verifyFirebaseToken = async (req, res, next) => {
    const authorization = req.headers.authorization;
    console.log('authorization is',authorization)
    if (!authorization) {
        return res.status(401).send({ message: 'Unauthorized access 1' });
    }

    const token = authorization.split(' ')[1];
    console.log('token is', token);

    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.decoded_email = decoded.email;
        console.log('decoded email holo', req.decoded_email);
        next();
    } catch (error) {
        console.error('Error verifying Firebase token:', error);
        return res.status(401).send({ message: 'Unauthorized access 2' });
    }
};

const verifyJWTToken = async (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }

    const token = authorization.split(' ')[1];
    console.log('token is', token);

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Unauthorized access' });
        }

        console.log('after decoded', decoded);
        req.decoded_email = decoded.email;
        next();
    });
};

const crypto = require("crypto");

const generateTrackingId = () => {
  const prefix = "TRK"; 
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ""); 
  const random = crypto.randomBytes(3).toString("hex").toUpperCase(); 
  return `${prefix}-${date}-${random}`;
};



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.sc7dsau.mongodb.net/?appName=Cluster0`;


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
const paymentCollections = db.collection('payments')
const applicationCollections = db.collection('applications')
const trackingsCollections = db.collection('trackings')

const logTrackings = async(trackingId,userEmail, 
        status,)=>{
    const log = {
        trackingId, 
        userEmail,
        status,
        details:status.split('_').join(' '),
        createdAt: new Date()

    }
    const result = await trackingsCollections.insertOne(log)
    return result;
}

// tracking related apis 
app.get('/trackings/student', verifyFirebaseToken, async(req, res)=>{
    const email = req.query.email;
    const query = {userEmail:email}
    const result = await trackingsCollections.find(query).sort({createdAt:-1}).toArray();
    res.send(result)
})
app.get('/trackings/tutor', verifyFirebaseToken, async(req, res)=>{
    const email = req.params.email
    const query = {tutorEmail:email}
    const tuitions = await tuitionsCollections.find(query).toArray();
    const trackingIds = tuitions.map(tuition => tuition.trackingId);
    const trackingIdQuery = {trackingId:{
        $in: trackingIds
    }}
const result = await trackingsCollections.find(trackingIdQuery).sort({createdAt:-1}).toArray();

res.send(result)

})

// user related apis 
app.post('/users',async(req, res)=>{
    const user = req.body;
   if(!user.role){
  user.role = "student";
}
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
res.send({name:user?.displayName,role:user?.role, email:user?.email, phoneNumber:user?.phoneNumber,})
})


app.patch('/users/update/:email', async (req, res) => {
  const email = req.params.email;
  const updatedData = req.body;
console.log('email r updateddaata', email, updatedData)
 if (!email) {
    return res.status(403).send({ message: "Forbidden" });
}

  const query = { email:email };
  const updateDoc = {
    $set: updatedData
  };

  const result = await usersCollections.updateOne(query, updateDoc);

  res.send(result);
});

app.delete('/users/delete/:email', verifyFirebaseToken,async(req, res)=>{

    const email = req.params.email;
    const query = {email}
    const result = await usersCollections.deleteOne(query)
    res.send(result)

})



// tuition related apis 
app.post('/tuitions',async(req,res)=>{
    const tuitions = req.body;
     const userEmail = req.decoded_email;
    const trackingId = generateTrackingId()
    tuitions.trackingId = trackingId;
    tuitions.paymentStatus='Unpaid'
    tuitions.status= 'pending'
    tuitions.createdAt= new Date();
    const result = await tuitionsCollections.insertOne(tuitions)
    logTrackings(trackingId,userEmail, 'tuition_created')
    res.send(result)
})

app.get('/tuitions', async (req, res)=>{
const {limit,email, subject, location} =  req.query


if(email){
    const result = await tuitionsCollections.find({email:email}).sort({createdAt:-1}).toArray();
    console.log('result', result)
    return  res.send(result)
}



    if(!email && limit){
const result = await tuitionsCollections.find().sort({date:-1}).limit(8).toArray()
     res.send(result)
    }


    if(!limit){
    const page = parseInt(req.query.page) || 1
    
    const limit = 6;
    const skip = (page-1)*limit
    const query = {}
    if(subject){
        query.subject={$regex:subject, $options:'i'}
    }
    if(location){
        query.location={$regex:location,$options:'i'}
    }
    const total = await tuitionsCollections.countDocuments(query);

    const result = await tuitionsCollections.find(query).sort({createdAt:-1}).skip(skip).limit(limit).toArray();
    return  res.send({tuitions:result, page, totalPages:Math.ceil(total/limit)})
}


    
})



app.get('/tuitions/:id', async(req, res)=>{
    const id = req.params.id;
console.log('id of tuition', id)
    const query = {_id: new ObjectId(id)}
    const result = await tuitionsCollections.findOne(query)
    res.send(result)
})

app.patch('/tuitions/approve/:id', verifyFirebaseToken, async (req, res) => {
    const id = req.params.id;
const {trackingId, email} = req.body
const userEmail = email;
    const query = { _id: new ObjectId(id) };
    const updateDoc = {
        $set: {
            status: "approved",
            trackingId,
            email:email,
            updatedAt: new Date()
        }
    };

    const result = await tuitionsCollections.updateOne(query, updateDoc);
   
    logTrackings(trackingId,userEmail,'tuition_approved')
    res.send(result);
});

app.patch('/tuitions/reject/:id', verifyFirebaseToken, async (req, res) => {
    const id = req.params.id;
const {trackingId, email} = req.body
    const query = { _id: new ObjectId(id) };
    const updateDoc = {
        $set: {
            status: "rejected",
            trackingId,
            userEmail:email,
            updatedAt: new Date()
        }
    };

    const result = await tuitionsCollections.updateOne(query, updateDoc);
   logTrackings(trackingId,userEmail, 'tuition_rejected')
   
    res.send({ success: true, message: "Tuition Rejected", result });
});

app.get('/approvedApplications/approved',verifyFirebaseToken, async (req, res) => {

  const query = { status: 'approved',email:req.decoded_email}

        const approvedApplications = await applicationCollections.find(query).sort({ createdAt: -1 }).toArray();
        console.log('approveedapplications', approvedApplications)
        res.send(approvedApplications);
});


app.patch('/tuitions/update/:id', async(req, res)=>{
    const id = req.params.id;
    const updatedTuitions = req.body;
    const query = {_id:new ObjectId(id)}
    const updatedDoc = {
        $set:{
            class:updatedTuitions.class,
            subject:updatedTuitions.subject,
            days:updatedTuitions.days,
            time:updatedTuitions.time,
            phoneNumber:updatedTuitions.phoneNumber,
            updatedAt: new Date()
        }
    }
    const result = await tuitionsCollections.updateOne(query, updatedDoc)
res.send(result)
})
app.delete('/tuitions/:id', async(req, res)=>{
    const id = req.params.id;
    const query = {_id:new ObjectId(id)}
    const result = await tuitionsCollections.deleteOne(query);
    res.send(result)
})

// payment related apis 
app.post('/payment-checkout-session',verifyFirebaseToken, async(req, res)=>{

    const paymentInfo = req.body;
    const trackingId = generateTrackingId();
    const amount = parseInt(paymentInfo.budget) *100
    console.log('amount is', amount, paymentInfo.budget)
    console.log('paymentInfo', paymentInfo)
     const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        
        price_data:{
            currency:'USD',
            product_data:{name: 'Tuition Payment'},
            unit_amount:amount
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    metadata:{
        tuitionId:paymentInfo.tuitionId,
         studentName:paymentInfo.studentName, 
         trackingId: trackingId,
        applicationId: paymentInfo.applicationId,
    },
    customer_email:paymentInfo.email,
    success_url: `${process.env.MY_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.MY_DOMAIN}/dashboard/payment-cancelled`,
  });
res.send({url:session.url})


})

app.patch('/payment-success', verifyFirebaseToken,async (req, res)=>{
    const sessionId  = req.query.session_id;

    const session = await stripe.checkout.sessions.retrieve(sessionId)
    console.log('Stripe metadata tuitionId:', session.metadata.tuitionId)
const trackingId=session.metadata.trackingId
    const transactionId = session.payment_intent
    console.log('transactionId', transactionId)
    const query = {transactionId:transactionId}
    const existedPayment = await paymentCollections.findOne(query)

    if(existedPayment){
        return res.send({message: 'Payment Already Existed', transactionId, trackingId:existedPayment.trackingId})
    }

    if(session.payment_status === 'paid'){
        const tuitionId = session.metadata.tuitionId
        const applicationId = session.metadata.applicationId
        console.log('applicationId', applicationId)
        const query = {id:new ObjectId(tuitionId)}

        const update = {
            $set:{
                paymentStatus:'paid',

            }
        }
        const tuitionUpdateResult = await tuitionsCollections.updateOne(query, update)
 
   const payment = {
   studentName: session.metadata.studentName,
   email: session.customer_email,
   amount: session.amount_total / 100,
   currency: session.currency,
   tuitionId: session.metadata.tuitionId,
   transactionId: session.payment_intent,
   trackingId: trackingId,
   status: session.payment_status,
   paidAt: new Date(),
};


const paymentResult = await paymentCollections.insertOne(payment)
 

let applicationResult ;
if(applicationId){
    const applicationQuery = {_id: new ObjectId(applicationId)}
const updateApplication = {
    $set:{
        status:'approved'
    }
}
    applicationResult = await applicationCollections.updateOne(applicationQuery, updateApplication)
}

const userEmail = session.customer_email
logTrackings(trackingId,userEmail, 'payment_success')


 res.send({
    success:true, 
    tuitionUpdateResult,
    paymentResult ,
     applicationResult ,
     transactionId:session.payment_intent,trackingId:trackingId})
 

 
    }

return res.send({success:false})

})


app.get('/payments',verifyFirebaseToken,async (req, res)=>{

    console.log('decoded',req.decoded_email)
    const email = req.decoded_email;
    const query = {email:email}
const result = await paymentCollections.find(query).sort({paidAt:-1}).toArray();
res.send(result)

})

// applications related apis 

app.post('/applications', async (req, res) => {
    
        const appliedTuitions = req.body;
        appliedTuitions.status = 'pending';
        appliedTuitions.date = new Date();

        
        const existed = await applicationCollections.findOne({
            email: appliedTuitions.email,
            trackingId:appliedTuitions.trackingId,
            tuitionPostId: appliedTuitions.tuitionPostId
        });

        if (existed) {
            return res.status(400).send({ message: 'You already applied for this tuition.' });
        }

        const result = await applicationCollections.insertOne(appliedTuitions);
const trackingId  = appliedTuitions.trackingId
        const userEmail = req.decoded_email;
        logTrackings(trackingId, userEmail,'application_submitted')
       
res.send(result)


});

app.get('/applications',verifyFirebaseToken,async(req, res)=>{
    const result = await applicationCollections.find().sort({data:-1}).toArray();
    res.send(result)
})

app.patch('/applications/update/:id',verifyFirebaseToken, async(req, res)=>{
    const id = req.params.id;
    const updatedData = req.body;
    const query = {_id: new ObjectId(id)}
    const updatedDoc = {
        $set: {
            phoneNumber: updatedData.phoneNumber,
            tuitionPostDays: updatedData.tuitionPostDays,
            tuitionPostTime: updatedData.tuitionPostTime,
            updatedAt: new Date()
        }
    }
    const result = await applicationCollections.updateOne(query, updatedDoc)
    res.send(result)
})

app.patch('/applications/reject/:id', verifyFirebaseToken, async (req, res) => {
  const id = req.params.id;

  const query = {_id: new ObjectId(id)}
  const updateStatus = {
    $set:{
        status:'rejected'
    }
  }
  const result = await applicationCollections.updateOne(
    query,
    updateStatus
  );

  res.send({ success: true, message: "Application rejected", result });
});


app.delete('/applications/:id',verifyFirebaseToken, async(req, res)=>{
    const id = req.params.id;
    const query = {_id: new ObjectId(id)}
  
    const result = await applicationCollections.deleteOne(query)
    res.send(result)
})

// revenue API
app.get('/revenue', verifyFirebaseToken, async (req, res) => {
  
        const tutorEmail = req.decoded_email;
        const query = {email:tutorEmail}
        const payments = await paymentCollections.find(query).sort({ paidAt: -1 }).toArray();

        const totalEarnings = payments.reduce((sum, p) => sum + p.amount, 0);
        res.send({ payments, totalEarnings });
  
});

// reviow
app.post("/tuition/review/:id", async (req, res) => {
  const id = req.params.id;
  const checks = req.body;

  const reviewData = {
    ...checks,
    reviewedAt: new Date(),
  };
const reviewQuery = { _id: new ObjectId(id) }
const updateReview = {
    $set:{
        reviewChecklist:reviewData
    }
}
  const result = await tuitionsCollections.updateOne(
    reviewQuery,
    updateReview
  );

  res.send({ success: true, result });
});

// admin summery 

app.get('/admin/report-summary', verifyFirebaseToken, async (req, res) => {
    const pipeline = [
        {
            $group: {
                _id: null,
                totalEarnings: { $sum: "$amount" },
                totalTransactions: { $sum: 1 }
            }
        }
    ]
    const total = await paymentCollections.aggregate(pipeline).toArray();

    const summary = total[0] || { totalEarnings: 0, totalTransactions: 0 };

    res.send(summary);
});

app.get('/admin/transactions', verifyFirebaseToken, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const totalTransactions = await paymentCollections.countDocuments();
    const transactions = await paymentCollections.find()
        .sort({ paidAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

    res.send({
        transactions,
        page,
        totalPages: Math.ceil(totalTransactions / limit),
    });
});

app.get('/admin/weekly-revenue',verifyFirebaseToken, async (req, res)=>{
    const weeks = req.query.weeks;
    const pipeline = [
        {
            $group:{
                _id:{
                    year:{$year: '$paidAt'},
                    week:{$week:'$paidAt'}
                },
                total:{$sum:'$amount'}
            }
        },
            {
                $sort:{'_id.year':1, '_id.week':1}
            }
    ]

    const result = await paymentCollections.aggregate(pipeline).toArray();
res.send(result)
})

// Admin dashboard summary
app.get('/admin/dashboard-stats', verifyFirebaseToken, async (req, res) => {
 
       
        const totalUsers = await usersCollections.countDocuments();
        const activeUsers = await usersCollections.countDocuments({ role: { $in: ['student','tutor','admin'] } }); 
      
        const totalTuitions = await tuitionsCollections.countDocuments();
        const pendingTuitions = await tuitionsCollections.countDocuments({ status: 'pending' });
        const approvedTuitions = await tuitionsCollections.countDocuments({ status: 'approved' });

      
        const payments = await paymentCollections.find().toArray();
        const totalEarnings = payments.reduce((sum, p) => sum + p.amount, 0);

        res.send({
            totalUsers,
            activeUsers,
            totalTuitions,
            pendingTuitions,
            approvedTuitions,
            totalEarnings
        });


});


app.get('/admin/monthly-revenue', verifyFirebaseToken, async (req, res) => {
    const months = parseInt(req.query.months) || 12;

    const pipeline = [
        {
            $group: {
                _id: { year: { $year: "$paidAt" }, month: { $month: "$paidAt" } },
                total: { $sum: "$amount" }
            }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
    ];

    const result = await paymentCollections.aggregate(pipeline).toArray();
    res.send(result);
});


// tutor related apis 
app.get('/tutors', async(req, res)=>{
    
    const {limit} = req.query;
    if(!limit){

            const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page-1) *limit
    const total = await tutorCollections.countDocuments();
    const result = await tutorCollections.find().sort({createdAt:-1}).skip(skip).limit(limit).toArray();
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