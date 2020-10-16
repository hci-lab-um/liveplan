var express = require('express')
var cors = require('cors')
var app = express()

srv = app.listen(process.env.PORT)
app.use('/peerjs', require('peer').ExpressPeerServer(srv))

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: false}));