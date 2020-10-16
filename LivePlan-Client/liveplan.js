var roomName = "";
var readybuttonbool = true;

$(document).ready(function () {
//local stream
    navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        .then(function(stream) {
            var video = document.getElementById('video');
            if ("srcObject" in video) {
                video.srcObject = stream;
            } else {
                video.src = window.URL.createObjectURL(stream);
            }
            video.onloadedmetadata = function(e) {
                video.play();
            };
        })
        .catch(function(err) {
            console.log(err.name + ": " + err.message);
        });


    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view');
    const student = urlParams.get('student');
    const teacher = urlParams.get('teacher');
    roomName = student;

    //Change view according to parameters
    switch (view) {
        case 'student': {
            $('.teacheronly').hide();

        }
            break;
        case 'teacher': {
            $('.teacheronly').show();

        }
    }

    if (view == "teacher") {
        //hide non student elements
        $('.teacheronly').show();


    }

    //Setup unique room hash
    if (student) {
        var viewMode = 1;
        if (localStorage.getItem(roomName + '_viewmode') == null)
            localStorage.setItem(roomName + '_viewmode', 1);
        else
            viewMode = parseInt(localStorage.getItem(roomName + '_viewmode'));

        $('#imagetypes').val(viewMode);

        renderAvailableActivities(viewMode);
        renderPlannedActivities(viewMode);
        bindEventHandlers();
        setupPubnub();
        setupVideoStreams(view, student, teacher);

    }
});



function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

// **************** Live communication area *****************************

const uuid = PubNub.generateUUID();
const pubnub = new PubNub({
    publishKey: "[PUBLISH-KEY]",
    subscribeKey: "[SUBSCRIBE-KEY]",
    uuid: uuid
});


function setupPubnub() {
    var lastCardMoved;
    pubnub.addListener({
        status: function (statusEvent) {
            if (statusEvent.category === "PNConnectedCategory") {
                console.log('Pubnub connected');
            }
        },
        message: function (event) {
            //Only process on remote partner
            if (event.message.sender != uuid) {
                switch (event.message.action) {
                    case "changeactivityview": {
                        localStorage.setItem(roomName + '_viewmode', event.message.type)
                        changeActivityViewType(event.message.type);
                    }
                        break;
                    case "sortstart": {
                        lastCardMoved = $('#' + event.message.card);
                        $("#" + event.message.card).effect("highlight");
                        $("#" + event.message.card).addClass("selected-card", 0, "easeInBounce");
                    }
                        break;
                    case "sortstop": {
                        $("#" + event.message.card).effect("highlight");
                        $("#" + event.message.card).removeClass("selected-card", 0, "easeInBounce");
                    }
                        break;
                    case "sortupdate": {
                        if (event.message.container) {
                            var ids = event.message.cards.split(',');
                            for (var i = 0; i < ids.length; i++) {
                                $(event.message.container).append($("#" + ids[i]));
                                $("#" + ids[i]).removeClass("selected-card", 0, "easeOutBounce");
                            }

                            $(event.message.container).sortable('refresh');

                            //Scroll last moved card into view
                            $([document.documentElement, document.body]).animate({
                                scrollTop: lastCardMoved.offset().top
                            }, 2000);

                            //Autosave
                            saveSchedule();
                        }
                    }
                        break;
                    case "timeupdate": {
                        //Scroll last moved card into view
                        $([document.documentElement, document.body]).animate({
                            scrollTop: $('#' + event.message.card).offset().top
                        }, 500);
                        $('#' + event.message.container).val(event.message.value);
                        $('#' + event.message.container).effect("highlight");
                    }
                        break;
                    case "save": {
                        saveSchedule();
                    }
                        break;
                    case "reset": {
                        resetSchedule();
                    }
                        break;
                    case"enable ready":
                    {
                        enablereadybutton();

                    }
                        break;
                    case"disable ready":
                    {
                        disablereadybutton();

                    }
                        break;
                    case "activityready": {
                        markActivityReadyAndSave(event.message.card)
                    }
                }
            }
        }
    })

    pubnub.subscribe({
        channels: [roomName]
    });

}

// **************************************************************************************************** */

// ***************************************** Event Handlers ******************************************* */

function bindEventHandlers() {

    $('#disable_enable_readybutton').click(function () {
        if(readybuttonbool ==  true) {
            disablereadybutton();
            pubnub.publish({
                channel: roomName,
                message: {"sender": uuid, "action": "disable ready"}
            }, function (status, response) {
                console.log(status);
            });
            console.log(readybuttonbool)
        }else if(readybuttonbool == false) {
            enablereadybutton();
            pubnub.publish({
                channel: roomName,
                message: {"sender": uuid, "action": "enable ready"}
            }, function (status, response) {
                console.log(status);
            });
            console.log(readybuttonbool)
        }
    });

    $('#saveSchedule').click(function () {
        saveSchedule();
        pubnub.publish({
            channel: roomName,
            message: {"sender": uuid, "action": "save"}
        }, function (status, response) {
            console.log(status);
        });
    });

    $('#resetSchedule').click(function () {
        resetSchedule();
        pubnub.publish({
            channel: roomName,
            message: {"sender": uuid, "action": "reset"}
        }, function (status, response) {
            console.log(status);
        });
    });

    $('#imagetypes').change(function () {
        var valueSelected = this.value;
        localStorage.setItem(roomName + '_viewmode', valueSelected);
        changeActivityViewType(valueSelected);

        pubnub.publish({
            channel: roomName,
            message: {"sender": uuid, "action": "changeactivityview", "type": valueSelected}
        }, function (status, response) {
            console.log(status);
        });
    });

    $("#planned, #available").sortable({
        connectWith: ".connectedSortable",
        scroll: true,
        scrollSensitivity: 100,
        scrollSpeed: 5,
        revert: 100
    });

    $("#planned, #available").bind('sortstart', function (event, ui) {
        var cardid = ui.item.attr('id')
        pubnub.publish({
            channel: roomName,
            message: {"sender": uuid, "action": "sortstart", "container": "", "card": cardid}
        }, function (status, response) {
            console.log(status);
        });
    });

    $("#planned, #available").bind('sortstop', function (event, ui) {
        var cardid = ui.item.attr('id');
        pubnub.publish({
            channel: roomName,
            message: {"sender": uuid, "action": "sortstop", "container": "", "card": cardid}
        }, function (status, response) {
            console.log(status);
        });
    });

    $("#planned, #available").bind('sortupdate', function (event, ui) {
        //Autosave
        saveSchedule();

        var cardcontainerid = ui.item.parent().attr('id');
        pubnub.publish({
            channel: roomName,
            message: {
                "sender": uuid,
                "action": "sortupdate",
                "container": "#" + cardcontainerid,
                "cards": $("#" + cardcontainerid).sortable('toArray').join(',')
            }
        }, function (status, response) {
            console.log(status);
        });
    });
}

function markActivityReadyAndSave(cardid) {
    var cardElement = document.getElementById(cardid);
    cardElement.classList.add('animated', 'flipOutY');

    setTimeout(function () {
        //Remove from scheduled activities list and place on available activities list
        $(cardElement).appendTo('#available');
        saveSchedule();
        //Remove animation class
        cardElement.classList.remove('animated', 'flipOutY');
    }, 1000);


}

function resetSchedule() {
    var cardsToSave = [];
    localStorage.setItem(roomName + '_timetable', JSON.stringify(cardsToSave));

    var viewMode = 0;
    if (localStorage.getItem(roomName + '_viewmode') == null)
        localStorage.setItem(roomName + '_viewmode', 0);
    else
        viewMode = parseInt(localStorage.getItem(roomName + '_viewmode'));

    renderAvailableActivities(viewMode);
    renderPlannedActivities(viewMode);
}
// disabling the ready button - by default it is disabled
function disablereadybutton() {
    var elementsofbuttonsreturned = document.getElementsByClassName("ready_buttons");
    for (var i = 0; i < elementsofbuttonsreturned.length; i++) {
        elementsofbuttonsreturned[i].disabled = true
    }
    var button = document.getElementById("disable_enable_readybutton");
    button.innerHTML = "Enable Ready Button";
    readybuttonbool = false

}
function enablereadybutton() {

    var elementsofbuttonsreturned = document.getElementsByClassName("ready_buttons");
    for (var i = 0; i < elementsofbuttonsreturned.length; i++) {
        elementsofbuttonsreturned[i].disabled = false
    }
    var button = document.getElementById("disable_enable_readybutton");
    button.innerHTML = "Disable Ready Button";
    readybuttonbool = true
}

function saveSchedule() {
    var cardsToSave = [];

    //get all planned cards
    var cards = document.getElementById("planned").getElementsByTagName("li");
    disablereadybutton()
    Array.prototype.forEach.call(cards, function (card) {
        cardsToSave.push({
            activity: card.firstChild.getElementsByClassName("svtitle")[0].innerText,
            img: card.firstChild.getElementsByClassName("svimg")[0].src,
            time: card.firstChild.getElementsByClassName("svt")[0].value,
            id: card.id
        });
        console.log(cardsToSave);
    });
    localStorage.setItem(roomName + '_timetable', JSON.stringify(cardsToSave));
}

function loadAllActivitiesFromServer(callback) {
    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType("application/json");
    xobj.open('GET', 'data/activities.json', true);
    xobj.onreadystatechange = function () {
        if (xobj.readyState == 4 && xobj.status == "200") {
            callback(xobj.responseText);
        }
    };

    xobj.send(null);
}

function renderAvailableActivities(viewMode) {
    //Remove existing items
    $('#available').empty();
    loadAllActivitiesFromServer(function (response) {
        var availableTasks = JSON.parse(response);
        for (var i = 0; i < availableTasks.Tasks.length; i++) {
            //Only add if not already in planned tasks
            if (!document.getElementById(availableTasks.Tasks[i].TaskId)) {
                var card = document.createElement("div");
                card.className = "sortable-card maincard active";
                var cardoverlay = document.createElement("div");
                cardoverlay.className = "view overlay";
                card.appendChild(cardoverlay);
                var img = document.createElement("img");
                img.className = "card-img-top svimg";
                img.src = availableTasks.Tasks[i].Pictures[viewMode - 1];
                img.alt = availableTasks.Tasks[i].Pictures[viewMode - 1];
                cardoverlay.appendChild(img);

                var cardbody = document.createElement("div");
                cardbody.className = "card-body";
                var title = document.createElement("h4");
                title.className = "card-title svtitle";
                cardbody.appendChild(title);

                var titlenode = document.createTextNode(availableTasks.Tasks[i].NameofThing);
                title.appendChild(titlenode);

                var cardtime = document.createElement("input");
                cardtime.className = "form-control svt";
                var cardid = availableTasks.Tasks[i].TaskId
                cardtime.id = "textbox_" + cardid;
                cardtime.placeholder = "Time";

                cardbody.appendChild(cardtime);
                card.appendChild(cardbody);

                var readybutton = document.createElement("button");
                readybutton.className = "btn btn-primary animated ready_buttons";
                readybutton.id = "readybtn_" + cardid;
                readybutton.addEventListener("click", function () {
                    //Send id of card id (which is an ancestor of the clicked button)
                    markActivityReadyAndSave(this.parentElement.parentElement.parentElement.id)

                    pubnub.publish({
                        channel: roomName,
                        message: {
                            "sender": uuid,
                            "action": "activityready",
                            "card": this.parentElement.parentElement.parentElement.id
                        }
                    }, function (status, response) {
                        console.log(status);
                    });
                });

                readybutton.textContent = "READY";
                cardbody.appendChild(readybutton);


                var listitem = document.createElement("li");
                listitem.classname = "list-group-item listitem";
                listitem.id = availableTasks.Tasks[i].TaskId
                listitem.appendChild(card);

                var element = document.getElementById("available");
                element.appendChild(listitem);

                //Bind realtime updates
                $("#textbox_" + availableTasks.Tasks[i].TaskId).keyup(function () {
                    pubnub.publish({
                        channel: roomName,
                        message: {
                            "sender": uuid,
                            "action": "timeupdate",
                            "card": this.parentElement.parentElement.parentElement.id,
                            "container": this.id,
                            "value": this.value
                        }
                    }, function (status, response) {
                        console.log(status);
                    });
                });
            }
        }
        disablereadybutton()

    });
}
//Set incoming call dialog events
var modal = document.getElementById("incomingCall");
var closeCallModal = document.getElementsByClassName("close")[0];
var answerCallButton = document.getElementsByClassName("answer")[0];
var rejectCallButton = document.getElementsByClassName("reject")[0];
var audio = new Audio('assets/audio/call.mp3');

closeCallModal.onclick = function() {
    modal.style.display = "none";
    audio.pause();
};
rejectCallButton.onclick = function() {
    modal.style.display = "none";
    audio.pause();
};

function renderPlannedActivities(viewMode) {
    //Remove existing items
    $('#planned').empty();
    var plannedActivities;
    if (localStorage.getItem(roomName + '_timetable') != null) {
        plannedActivities = JSON.parse(localStorage.getItem(roomName + '_timetable'));

        Array.prototype.forEach.call(plannedActivities, function (plannedActivity) {
            var card = document.createElement("div");
            card.className = "sortable-card maincard active";
            var cardoverlay = document.createElement("div");
            cardoverlay.className = "view overlay";
            card.appendChild(cardoverlay);
            var img = document.createElement("img");
            img.className = "card-img-top svimg";
            if (plannedActivity.img)
                img.src = plannedActivity.img.replace("type1", "type" + (viewMode)).replace("type2", "type" + (viewMode)).replace("type3", "type" + (viewMode));
            img.alt = plannedActivity.activity;
            cardoverlay.appendChild(img);

            var cardbody = document.createElement("div");
            cardbody.className = "card-body";
            var title = document.createElement("h4");
            title.className = "card-title svtitle";
            cardbody.appendChild(title);
            var titlenode = document.createTextNode(plannedActivity.activity);
            title.appendChild(titlenode);

            var cardtime = document.createElement("input");
            cardtime.className = "form-control svt";
            cardtime.id = "textbox_" + plannedActivity.id;
            cardtime.placeholder = "Time";
            cardtime.value = plannedActivity.time;

            var readybutton = document.createElement("button");
            readybutton.className = "btn btn-primary animated ready_buttons";
            readybutton.id = "readybtn_" + plannedActivity.id;
            readybutton.addEventListener("click", function () {
                //Send id of card id (which is an ancestor of the clicked button)
                markActivityReadyAndSave(this.parentElement.parentElement.parentElement.id)

                pubnub.publish({
                    channel: roomName,
                    message: {
                        "sender": uuid,
                        "action": "activityready",
                        "card": this.parentElement.parentElement.parentElement.id
                    }
                }, function (status, response) {
                    console.log(status);
                });
            });

            readybutton.textContent = "READY";
            readybutton.disabled = true;
            cardbody.appendChild(readybutton);

            //Bind realtime updates
            cardtime.onkeyup = function () {
                pubnub.publish({
                    channel: roomName,
                    message: {
                        "sender": uuid,
                        "action": "timeupdate",
                        "card": this.parentElement.parentElement.parentElement.id,
                        "container": "textbox_" + plannedActivity.id,
                        "value": this.value
                    }
                }, function (status, response) {
                    console.log(status);
                });
            };

            cardbody.appendChild(cardtime);
            card.appendChild(cardbody);

            var listitem = document.createElement("li");
            listitem.classname = "list-group-item";
            listitem.id = plannedActivity.id;
            listitem.appendChild(card);

            var element = document.getElementById("planned");
            element.appendChild(listitem);
        });


    }
}

function changeActivityViewType(viewMode) {
    $('#imagetypes').val(viewMode);
    renderAvailableActivities(viewMode);
    renderPlannedActivities(viewMode);
}

//*************************************** P2P Video Streaming ********************************************* */

function setupVideoStreams(view, student, teacher) {
    var peer, otherperson, myself;

    //Setup PeerJS
    switch (view) {
        case "student": {
            otherperson = teacher;
            myself = student;

        }
            break;
        case "teacher": {
            otherperson = student;
            myself = teacher;
        }
            break;
    }

    peer = new Peer(myself, {
        host: "[PEERSERVER-URL]",
        path: "peerjs",
        port: location.port || (location.protocol === 'https:' ? 443 : 80),
        debug: 3
    });

    //All set up for calls
    peer.on('open', function (id) {
        console.log('My peer ID is: ' + id);

    });

    //Handle incoming call
    peer.on('call', function(call) {
        //Display modal
        document.getElementById("callerMessage").innerText ="Call is Starting, Accept?";
        modal.style.display = "block";

        audio.play();

        answerCallButton.onclick= function(){
            //stop audio
            audio.pause();



        // handle browser prefixes
        navigator.getUserMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
        // Get access to microphone
        navigator.getUserMedia ({ video: true, audio: true},
            // Success callback
            function success(localMediaStream) {
                call.answer(localMediaStream); // Answer the call with an A/V stream.
                call.on('stream', function(remoteStream) {
                    var remoteVideo = document.querySelector('#videoStream');
                    try {
                        remoteVideo.srcObject = remoteStream;
                        modal.style.display = "none";
                    } catch (error) {
                        remoteVideo.src = window.URL.createObjectURL(remoteStream);
                    }

                });
            },
            // Failure callback
            function error(err) {
                console.log('Failed to get local stream' + err);
                alert("Could not establish incoming call "+ err);
            });
        }
    });


    //Make calls
    $('#call-peer').text('Start Call');
    $('#call-peer').click(function () {
        // handle browser prefixes
        navigator.getUserMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
        // Get access to microphone
        navigator.getUserMedia ({ video: true, audio: true},
            // Success callback
            function success(localMediaStream) {
                var call = peer.call(otherperson, localMediaStream);
                call.on('stream', function(remoteStream) {
                    var remoteVideo = document.querySelector('#videoStream');
                    try {
                        remoteVideo.srcObject = remoteStream;
                    } catch (error) {
                        remoteVideo.src = window.URL.createObjectURL(remoteStream);
                        alert('other person not available right now');
                    }
                });
            },
            // Failure callback
            function error(err) {
                console.log('Failed to get local stream' + err);
                alert("Could not establish call "+ err);
            });
    });
}


function homeprint() {

    var k;
    if (localStorage.getItem(roomName + '_timetable') == null) {
        localStorage.setItem(roomName + '_timetable', JSON.stringify(timetable_objects));
        k = JSON.parse(localStorage.getItem(roomName + '_timetable'))

    } else {
        k = JSON.parse(localStorage.getItem(roomName + '_timetable'));

        for (var i = 0; i < k.Timetable.length; i++) {
            if (k.Timetable[i].Day == "Monday") {
                for (var x = 0; x < k.Timetable[i].Schedule.length; x++) {
                    var card = document.createElement("div");
                    card.className = "sortable-card maincard active animated";
                    card.id = "card" + x;
                    var cardoverlay = document.createElement("div");
                    cardoverlay.className = "view overlay";
                    card.appendChild(cardoverlay);
                    var img = document.createElement("img");
                    img.className = "card-img-top svimg";
                    img.src = k.Timetable[i].Schedule[x].img;
                    img.alt = k.Timetable[i].Schedule[x].img;
                    cardoverlay.appendChild(img);

                    var cardbody = document.createElement("div");
                    cardbody.className = "card-body";
                    var title = document.createElement("h4");
                    title.className = "card-title svtitle";
                    cardbody.appendChild(title);
                    var titlenode = document.createTextNode(k.Timetable[i].Schedule[x].activity);
                    title.appendChild(titlenode);

                    var cardtime = document.createElement("input");
                    cardtime.className = "form-control svt";
                    cardtime.placeholder = "Time";
                    cardtime.value = k.Timetable[i].Schedule[x].time;
                    cardbody.appendChild(cardtime);

                    var readybutton = document.createElement("button");
                    readybutton.className = "btn btn-primary animated";
                    readybutton.id = "rdybtn";
                    const trythis = x;
                    readybutton.addEventListener("click", function () {
                        ready(this, 'green', trythis)
                    });
                    readybutton.textContent = "READY";
                    cardbody.appendChild(readybutton);

                    card.appendChild(cardbody);
                    var element = document.getElementById("home");
                    element.appendChild(card);
                }

            }


        }


    }
}

