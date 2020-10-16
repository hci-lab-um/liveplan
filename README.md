# LivePlan
LivePlan was developed as an online tool affording real-time collaboration facilities, as well as peer-to-peer voice and video communication, to enable educators, learners and their guardians to co-create and manage daily activity schedules.

This project was developed at the University of Malta (HCI Lab) by Keith Vanhear under the supervision of Chris Porter.

## Setting up

The code in this repository is experimental - the result of an evolutionary prototyping process - and is informed through field-interventions over a number of iterations.

### LivePlan PeerServer

LivePlan makes use of `PeerJS`, which is an API to abstract P2P communication (for data as well as audio and video streams) between remote peers. A `PeerServer` is necessary to broker WebRTC connections between clients using PeerJS.

```
1 Publish PeerServer code (e.g. Azure AppService or Heroku)
2 Copy the server's public URL for use in the LivePlan Client
```

### LivePlan Client

The LivePlan Client makes use of `PubNub` and `PeerJS`. 

#### PubNub

PubNub is a realtime communication platform offering a Publish/Subscribe model for real-time data streaming. Peers on LivePlan use PubNub to establish and maintain a persistent socket connection, over which activity scheduling actions are communicated in realtime (e.g. creation of an activity, completion of an activity, re-ordering etc...).

A PubNub account is required, along with a set of API Keys. These keys should then be added to the code snippet below (in `liveplan.js`). LivePlan makes use of the [PubNub JavaScript SDK](https://www.pubnub.com/docs/web-javascript/data-streams-publish-and-subscribe). 

```
// **************** Live communication area *****************************

const uuid = PubNub.generateUUID();
const pubnub = new PubNub({
    publishKey: "[KEY],
    subscribeKey: "[KEY]",
    uuid: uuid
});
```

#### PeerJS

Although the publicly hosted [PeerServer Cloud](https://peerjs.com/peerserver.html) instance can be used to broker PeerJS connections (by not specifying the `host` and `key` options in the client code), it is recommended to use a private PeerServer instance - particularly if identifiable information is used while setting up P2P connections, which is also not recommended. After setting up your own PeerServer (see above), add the public URL to the configuration code shown below (in `livaplan.js`).

```
//*************************************** P2P Video Streaming ********************************************* */

peer = new Peer(myself, {
    host: "[URL]",
    path: "peerjs",
    port: location.port || (location.protocol === 'https:' ? 443 : 80),
    debug: 3
});
```

## People

- [Keith Vanhear](mailto:keith.vanhear.15@um.edu.mt)
- [Chris Porter](https://www.um.edu.mt/profile/chrisporter)

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
[GPL3](https://www.gnu.org/licenses/gpl-3.0.en.html)


