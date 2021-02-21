var data = {};
var isTabActive = true;
var fbStore = null;
var user = null;

$( document ).ready(function() {
    if (localStorage.getItem("rdonaturalist-wantsonline") == "yes") {
        if (fbStore == null) {
            initFB();
        } else {
            retrieve(true);
        }
    } else {
        retrieve(true);
    }
});

function retrieve(initOnly=false) {
    if (localStorage.getItem("rdonaturalist-wantsonline") == "yes") {
        var docRef = fbStore.collection("naturalist").doc(user.uid);
        docRef.get().then((doc) => {
            if (doc.exists) {
                data = doc.data().data;
                data.app.settings.storeOnline = true;
            } else {
                showNote("Your data could not be retrieved, invalid user ID. ("+user.uid+")");
            }
            if (initOnly) {
                afterRetrieve();
            } else {
                switchView(false);
            }
        }).catch((error) => {
            showNote("Error getting your data: "+error);
        });
    } else {
        if (localStorage.getItem("rdonaturalist")) {
            data = JSON.parse(localStorage.getItem("rdonaturalist"));

        } else {
            data = init_data;
        }
        if (initOnly) {
            afterRetrieve();
        } else {
            switchView(false);
        }
    }
}

function initFB(authOnly = false, checkForData = false) {
    //Initialise Firebase
    var firebaseConfig = {
        apiKey: "AIzaSyCtngRxb1qrONSEOnCn50jVDS2YaXpTOsk",
        authDomain: "spatial-flag-304521.firebaseapp.com",
        projectId: "spatial-flag-304521",
        storageBucket: "spatial-flag-304521.appspot.com",
        messagingSenderId: "275177704355",
        appId: "1:275177704355:web:20e5ba970a51bc6f476816",
        measurementId: "G-LYEQPEPJ25"
    };
    firebase.initializeApp(firebaseConfig);
    firebase.analytics();
    firebase.auth();

    fbStore = firebase.firestore();

    firebase.firestore().enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            showNote("Offline storage not available as you have multiple tabs open.");
        } else if (err.code == 'unimplemented') {
            showNote("Offline storage not available as your browser is unsupported.");
        }
    });

    //Handle authentication
    firebase.auth().onAuthStateChanged(changeuser => {
        if (changeuser) {
            user = firebase.auth().currentUser;
        }
        authCallBack(authOnly, checkForData);
    })
}

function authCallBack(authOnly, checkForData) {
    if (!user) {
        $("#oauth").modal('show');

        var ui = new firebaseui.auth.AuthUI(firebase.auth());

        var uiConfig = {
            callbacks: {
                signInSuccessWithAuthResult: function(authResult, redirectUrl) {
                    showNote("Successfully logged in.");
                    $("#oauth").modal("hide");
                    if (!authOnly) {
                        retrieve(true);
                    }
                    if (checkForData) {
                        checkForGoogleData();
                    }
                    return true;
                },
                uiShown: function() {
                    // The widget is rendered.
                    // Hide the loader.
                }
            },
            signInFlow: 'popup',
            //signInSuccessUrl: 'https://rjvbeek.github.io',
            signInOptions: [
                firebase.auth.GoogleAuthProvider.PROVIDER_ID
            ]
        };
        ui.start('#firebaseui-auth-container', uiConfig);
    } else {
        showNote("Successfully logged in.");
        if (!authOnly) {
            retrieve(true);
        }
        if (checkForData) {
            checkForGoogleData();
        }
    }
}

function afterRetrieve() {
    migrateData();

    //Select the view, to build the DOM
    $("select#view").val(data.app.view);
    switchView(false);

    //Update settings on opening settings modal
    $('#settings').on('show.bs.modal', function (e) {
         $("#set_categories").prop( "checked", data.app.settings.show_categories);
         $("#set_alpha").prop( "checked", data.app.settings.show_alpha);
         $("#set_normal").prop( "checked", data.app.settings.show_normal);
         $("#set_critters").prop( "checked", data.app.settings.show_critters);
         $("#set_legend").prop( "checked", data.app.settings.show_legend);
         $("#set_sedatedOnSample").prop( "checked", data.app.settings.sedatedOnSample);
         $("#set_storeOnline").prop( "checked", data.app.settings.storeOnline);
    });

    $("#search i").on("click", function(e) {
        if ($("#search input").hasClass("active")) {
            $("#search input").css("width", "0px");
            $("#search input").css("padding", "0px");
            $("#search input").css("margin", "0px");
            $("#search input").val("");
            handleSearch("");
        } else { 
            $("#search input").focus();
        }
        $("#search input").toggleClass("active");
    });

    $("#search input").on("keyup", function(e) {
        var val = $(this).val().toLowerCase();
        handleSearch(val);
    });
    $("#search input").on("focus", function(e) {
        $(this).css("width", "250px");
        $(this).css("padding", "0px 2px");
        $(this).css("margin", "0px 10px");
    });

    if (!data.app.help_shown) {
        $("#help").modal('show');

        data.app.help_shown = true;
        commit();
    }

    $("input[type=file]").change(function() {
        $('#upload-check').show();
        var file = $("input[type=file]")[0].files[0];
        if (file.size > 20000000) {
            $("#upload").modal('hide');
            showNote("Maximum upload size is 20Mb. File is "+(file.size / 1000000)+"Mb.");
        } else {
            var fr = new FileReader();
            fr.readAsDataURL(file);
            fr.onload = function () {
				ocr(fr.result.split(';base64,')[1]);
			};
        }
    });
    
    initCooldown();
    setInterval(function(){ cooldownTimer(); }, 30000);
}

function checkForGoogleData() {
    var docRef = fbStore.collection("naturalist").doc(user.uid);
    docRef.get().then((doc) => {
        if (doc.exists) {
            if (confirm("Online data already exists. Use online dataset? \nCancelling means that online data will be overridden by the current state of the app.")) {
                retrieve();
            } else {
                commit();
            }
        } else {
            commit();
        }
    });
}

function commit() {
    if (data.app.settings.storeOnline && user != null) {
        var userid = user.uid
        fbStore.collection("naturalist").doc(userid).set({
            "data": data
        }).then(() => {
        })
        .catch((error) => {
            showNote("Commit error: "+error);
        });
    } else {
        localStorage.setItem("rdonaturalist", JSON.stringify(data));
    }
}

function toggle(category) {
    $('.animals').collapse('hide');
    $('.categorydetails').collapse('hide');
    $('#category_'+category+'>.animals').collapse('show');
    $('#category_'+category+'>.categorydetails').collapse('show');
    

    data.app.collapse_shown = '#category_'+category+'>.animals, #category_'+category+'>.categorydetails';
    //commit();
}

function toggle_animal(animal) {
    $('.animal').collapse('hide');
    $('.animaldetails').collapse('hide');
    $('#animal_'+animal+'>.animal').collapse('show');
    $('#animal_'+animal+'>.animaldetails').collapse('show');

    data.app.collapse_shown_animal = '#animal_'+animal+'>.animal';
    //commit();
}

function sell(categoryID) {
    //We can only sell if all stamps are there
    if(data.categories[categoryID].stamped != data.categories[categoryID].total) {
        return false;
    }

    //Update stamps for category
    data.categories[categoryID].stamped = 0;
    $('#cat_stamped_'+categoryID).html(data.categories[categoryID].stamped);

    //Update stamped status of all animals in category
    for (animalID in data.animals) {
        if (data.animals[animalID].category == categoryID) {
            data.animals[animalID].stamped = false;
            $("#stamped_"+animalID).removeClass("bt_stamp_y");
            $("#stamped_"+animalID).addClass("bt_stamp_n");
        }
    }

    commit();
    styleRows();
    styleCategories();

    showNote("Traded in category "+data.categories[categoryID].name+".");
    gtag('event','Trade_in',{'event_category': data.categories[categoryID].name});
    return false;
}

function sample(animalID, undo=false) {
    if ((data.animals[animalID].type != "legendary" && data.animals[animalID].samples == 10 && !undo) || 
        (data.animals[animalID].type == "legendary" && data.animals[animalID].samples == 3 && !undo) || 
        (data.animals[animalID].samples == 0 && undo)) {
        return false;
    }

    //Update animal's sample count
    $("#samples_"+animalID).removeClass("bt_sample_"+data.animals[animalID].samples);
    undo ? data.animals[animalID].samples -- : data.animals[animalID].samples ++;
    $("#samples_"+animalID).addClass("bt_sample_"+data.animals[animalID].samples);

    //If this animal wasn't sampled before, update category's sampled count
    if(data.animals[animalID].samples == 1 && !undo) {
        data.categories[data.animals[animalID].category].sampled ++;
    }
    if(data.animals[animalID].samples == 0 && undo) {
        data.categories[data.animals[animalID].category].sampled --;
    }

    //Set animal property Studied to yes
    if (!undo) {
        data.animals[animalID]['studied'] = true;
        $("#studied_"+animalID+" i").html("check_box");
        data.animals[animalID]['sampled'] = true;
        $("#sampled_"+animalID+" i").html("check_box");
        if (data.app.settings.sedatedOnSample) {
            data.animals[animalID]['sedated'] = true;
            $("#sedated_"+animalID+" i").html("check_box");
        }
        styleProgressBar(animalID);

        if (data.animals[animalID].type == "legendary" && !$('#samples_'+animalID).hasClass('legend_stamped')) {
            $('#samples_'+animalID).addClass('legend_stamped');
        }
    }

    commit();
    styleRows();
    styleCategories();

    if(!undo) {
        showNote("Sampled "+data.animals[animalID].name+".");
        gtag('event','Sample',{'event_category': data.animals[animalID].name});
    } else {
        showNote("Undid sampling "+data.animals[animalID].name+".");
        gtag('event','Sample_undo',{'event_category': data.animals[animalID].name});
    }
    return false;
}

function stamp(animalID, undo=false) {
    //We cannot stamp if there are no samples, unless user specifically wants it
    if (data.animals[animalID].samples == 0 && !undo) {
        if (confirm("Stamp this animal you haven't sampled yet?")) {
            sample(animalID);
        } else {
            return false;
        }
    } else if (!data.animals[animalID].stamped && undo) {
        return false;
    }

    //Update the number of stamped animals in the category
    if (!data.animals[animalID].stamped && !undo) {
        data.categories[data.animals[animalID].category].stamped ++;
    } else if (data.animals[animalID].stamped && undo) {
        data.categories[data.animals[animalID].category].stamped --;
    }
    $('#cat_stamped_'+data.animals[animalID].category).html(data.categories[data.animals[animalID].category].stamped);

    //Update the animal's properties
    var doNotUpdate = data.animals[animalID].stamped && !undo;
    data.animals[animalID].stamped = !undo;

    $("#samples_"+animalID).toggleClass("bt_sample_"+data.animals[animalID].samples);
    undo ? data.animals[animalID].samples++ : data.animals[animalID].samples --;
    $("#samples_"+animalID).toggleClass("bt_sample_"+data.animals[animalID].samples);

    if (!doNotUpdate) {
        $("#stamped_"+animalID).toggleClass("bt_stamp_n");
        $("#stamped_"+animalID).toggleClass("bt_stamp_y");
    }

    //If no more samples remain for this animal, update category's sampled count
    if (data.animals[animalID].samples == 0 && !undo) {
        data.categories[data.animals[animalID].category].sampled --;
    } else if (data.animals[animalID].samples == 1 && undo) {
        data.categories[data.animals[animalID].category].sampled ++;
    }

    commit();
    styleRows();
    styleCategories();

    if(!undo) {
        showNote("Stamped "+data.animals[animalID].name+".");
        gtag('event','Stamp',{'event_category': data.animals[animalID].name});
    } else {
        showNote("Undid stamping "+data.animals[animalID].name+".");
        gtag('event','Stamp_undo',{'event_category': data.animals[animalID].name});
    }
    return false;
}

function toggleAnimalProperty(animalID, property) {
    data.animals[animalID][property] = !data.animals[animalID][property];
    
    var icon = (data.animals[animalID][property] == true) ? "check_box" : "check_box_outline_blank";
    $("#"+property+"_"+animalID+" i").html(icon);

    
    if (data.animals[animalID].type == "legendary" && property == "sampled") {
        if ($('#samples_'+animalID).hasClass('legend_stamped') && !data.animals[animalID][property]) {
            $('#samples_'+animalID).removeClass('legend_stamped');
        } else if (!$('#samples_'+animalID).hasClass('legend_stamped') && data.animals[animalID][property]) {
            $('#samples_'+animalID).addClass('legend_stamped');
        }
    }

    styleProgressBar(animalID);
    commit();
    gtag('event','Animal_property',{'event_category': property, 'event_label': data.animals[animalID].name});
}

function showNote(message, addToLog=true) {
    var html = '<div class="row note" style="height: 0px"><div class="col-xs-12">'+message+'</div></div>';

    $('#notes').prepend(html);
    $('.note').first().animate({"height": "25px"}, 200).delay(1500).animate({"height": "0px"}, 200, function() { $(this).remove() });

    if (addToLog) {
        var today = new Date();
        var date = (today.getDate()+'-'+today.getMonth()+1);
        var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
        var dateTime = date+' '+time;
        var html = '<div class="row"><div class="col-xs-12">'+dateTime+": "+message+'</div></div>';
        $('#notes-log').prepend(html);
    }
}

function startCooldown(species) {
    $('.cooldown_'+species).addClass("cooldown-active");
    var cool = new Date();
    cool.setHours( cool.getHours() + 72 );
    data.cooldowns[species] = cool;
    gtag('event','Start_cooldown',{'event_category': species});
    commit();
    cooldownTimer();
}

function stopCooldown(species) {
    $('.cooldown_'+species).removeClass("cooldown-active");
    delete data.cooldowns[species];
    gtag('event','Stop_cooldown',{'event_category': species});
    commit();
    cooldownTimer();
}

function formatnum(num) {
    return ("0" + num).slice(-2);
}

function cooldownTimer() {
    if (isTabActive) {
        for (i in data.cooldowns) {
            var now = new Date();
            var cooldown = new Date(data.cooldowns[i]);
            var msec = cooldown - now;
            var mins = Math.floor(msec / 60000);
            var hrs = Math.floor(mins / 60);
            mins = mins % 60;

            if ((hrs == 0 && mins == 0) || msec <= 0) {
                stopCooldown(i);
                showNote("Cooldown ended for legendary animal species: "+capitalise(i)+".");
                return false;
            }
            $('.cooldown_'+i+">span").html(formatnum(hrs)+":"+formatnum(mins));
        }
    }
}

function initCooldown() {
    for (i in data.cooldowns) {
        $('.cooldown_'+i).addClass("cooldown-active");
    }
    cooldownTimer();
}

function styleRows() {
    $('.todo').removeClass('todo');
    $('.tostamp').removeClass('tostamp');
    $('.stamped').removeClass('stamped');
    $('.stampedsampled').removeClass('stampedsampled');
    
    for (animalID in data.animals) {
        if (!data.animals[animalID].stamped && data.animals[animalID].samples == 0) {
            $('#animal_'+animalID).addClass("todo");
        }
        if (!data.animals[animalID].stamped && data.animals[animalID].samples > 0) {
            $('#animal_'+animalID).addClass("tostamp");
        }
        if (data.animals[animalID].stamped && data.animals[animalID].samples == 0) {
            $('#animal_'+animalID).addClass("stamped");
        }
        if (data.animals[animalID].stamped && data.animals[animalID].samples > 0) {
            $('#animal_'+animalID).addClass("stampedsampled");
        }
    }
}

function styleCategories() {
    if (data.app.view == "default") {
        $('.category').each(function() {
            if ($(this).find(".todo").length == 0) {
                $(this).find(".cat_image_ex").css("display", "block");
            } else {
                $(this).find(".cat_image_ex").css("display", "none");
            }
        });
    }
}

function styleProgressBar(animalID) {
    var props = 0;
    var totalProps=-1;
    for (i in animal_properties) {
        if (data.animals[animalID].type == "critter" && (animal_properties[i] == "sedated" || animal_properties[i] == "sampled")) {
            continue;
        }
        totalProps ++;
        if (data.animals[animalID][animal_properties[i]] === true) {
            props++;
        }
    }
    var perc = Math.round((props / totalProps) * 100); 
    $("#progress_"+animalID+">.progress-bar").css("width", perc+"%").html(perc+"%").attr("aria-valuenow",perc);
}

function saveSettings() {
    if (data.app.settings.storeOnline == undefined) {
        data.app.settings.storeOnline = false;
    }

    data.app.settings.show_categories = $("#set_categories").prop("checked");
    data.app.settings.show_alpha = $("#set_alpha").prop("checked");
    data.app.settings.show_normal = $("#set_normal").prop("checked");
    data.app.settings.show_critters = $("#set_critters").prop("checked");
    data.app.settings.show_legend = $("#set_legend").prop("checked");
    data.app.settings.sedatedOnSample = $("#set_sedatedOnSample").prop("checked");
    data.app.settings.storeOnline = $("#set_storeOnline").prop("checked");

    if (data.app.settings.storeOnline) {
        localStorage.setItem("rdonaturalist-wantsonline", "yes");
        if (!user) {
            initFB(true, true);
        } else { 
            switchView(false);
        }
    } else {
        localStorage.setItem("rdonaturalist-wantsonline", "no");
        commit();
        switchView(false);
    }
    
    gtag('event','Settings',data.app.settings);
}

function switchView(triggerGA = true) {
    $("#search input").css("width", "0px");
    $("#search input").css("padding", "0px");
    $("#search input").css("margin", "0px");
    $("#search input").val("");
    handleSearch("");

    init();
    styleRows();

    var view = $('select#view option:selected').val();
    if (view == "sell") {
        $("div.animalrow").not(".tostamp").parent().remove();
    } else if (view == "todo") {
        $("div.tostamp, div.stamped, div.stampedsampled, div.critter").parent().remove();
    }
    $("div.animals:not(:has(*))").parent().remove();

    if ($('.animal').length == 0) {
        $('#nothingtosee').show();
        $('#nothingtosee').removeClass("hidden");
    } else {
        $('#nothingtosee').hide();
    }

    data.app.view = view;
    
    if (triggerGA) {
        gtag('event','Switch_view',{'event_category': view});
    }
    styleCategories();
    initCooldown();
    commit();
    
    return false;
}

function init() {
    $('#category_container').html("");
    var oddsEvens = [];

    //Build category container div
    if (data.app.settings.show_categories === true) {
        for (categoryID in data.categories) {
            oddsEvens[categoryID] = "even";
            var category = data.categories[categoryID];
            var html = 
            "<div class=\"container category "+data.categories[categoryID].type+"\" id=\"category_"+categoryID+"\" data-category=\""+categoryID+"\">"+
                "<div class=\"row title\">";
                if (category.type !== "critters") { 
                    html +=
                        "<div class=\"col-xs-7 no-overflow\" onclick=\"toggle("+categoryID+")\"><h4><div class=\"cat_image_cont\"><img class=\"cat_image\" src=\"assets/cat"+categoryID+".png\" /><img class=\"cat_image_ex\" src=\"assets/exclamation.png\" /></div>"+category.name+"</h4></div>"+
                        "<div class=\"col-xs-5\">"+
                        "<h4><span id=\"cat_stamped_"+categoryID+"\">"+category.stamped+"</span>/"+category.total+" "+
                        "<input type=\"button\" class=\"bt_rdo bt_tradein\" onclick=\"sell("+categoryID+")\" /></h4></div></div>"+
                        "<div class=\"row categorydetails collapse\">"+
                        "<div class=\"col-xs-12\" onclick=\"toggle("+categoryID+")\">Trade-in price: $"+category.price.toLocaleString()+"</div></div>";
                } else {
                    html +=
                        "<div class=\"col-xs-12 no-overflow\" onclick=\"toggle("+categoryID+")\"><h4><div class=\"cat_image_cont\"><img class=\"cat_image\" src=\"assets/cat"+categoryID+".png\" /><img class=\"cat_image_ex\" src=\"assets/exclamation.png\" /></div>"+category.name+"</h4></div></div>";
                }
                html +=
                "<div class=\"row animals collapse\">"+
                "</div>"+
            "</div>";
            $('#category_container').append(html);
        }
    } else {
        var html = 
            "<div class=\"container category\" id=\"category_0\">"+
                "<div class=\"row title\">"+
                    "<div class=\"col-xs-12\"><h4>All animals</h4></div>"+
                "</div>"+
                "<div class=\"row animals\">"+
                "</div>"+
            "</div>";
            $('#category_container').append(html);
    }

    //Add animals to the category container
    for (animalID in data.animals) {
        var animal = data.animals[animalID];

        //Take normal/critter/legendary settings into account
        if (!data.app.settings.show_normal && animal.type == "normal") {
            continue;
        }
        if (!data.app.settings.show_critters && animal.type == "critter") {
            continue;
        }
        if (!data.app.settings.show_legend && animal.type == "legendary") {
            continue;
        }

        if (oddsEvens[animal.category] == "even") {
            oddsEvens[animal.category] = "odd";
        } else {
            oddsEvens[animal.category] = "even";
        }
        var html = 
        "<div class=\"container-fluid "+oddsEvens[animal.category]+"\" data-animal-name=\""+animal.name+"\"><div class=\"row title animalrow "+animal.type+"\" id=\"animal_"+animalID+"\">"+
            "<div class=\"col-xs-7 no-overflow\" onclick=\"toggle_animal("+animalID+")\"><h5>"+animal.name+"";
        
        if (animal.type == "legendary") { 
            html +="<i class=\"material-icons cooldown cooldown_"+animal.species+"\">timer</i>";
        }

        html +="</h5></div><div class=\"col-xs-5\"><h5>";

        if (animal.type !== "critter") { 
            var legendaryAddClass = (data.animals[animalID]["sampled"] === true && animal.type === "legendary") ? "legend_stamped" : "";
            html +=
                "<input type=\"button\" class=\"bt_rdo bt_sample_"+animal.samples+" "+legendaryAddClass+"\" id=\"samples_"+animalID+"\" onclick=\"sample("+animalID+")\" /> "+
                "<input type=\"button\" class=\"bt_rdo bt_stamp_y\" id=\"stamped_"+animalID+"\" onclick=\"stamp("+animalID+")\" /> ";
        }
        html +=  "</h5></div>";

        if (harriet_only.indexOf(parseInt(animalID)) > -1) { 
            html += 
            "<div class=\"container animaldetails collapse\">"+
            "<div class=\"row\">"+
            "<div class=\"col-xs-12\" onclick=\"toggle_animal("+animalID+")\">Can only be found in Harriet missions</div></div>"+
            "</div>";
        }
        

        html +=
        "<div class=\"animal collapse\">"+
        "<div class=\"container-fluid\">"+
        "<div class=\"row\">"+
        "<div class=\"col-xs-12\"><span class=\"cat_mini\">"+data.categories[animal.category].name+"</span>"+
            "<div class=\"progress\" id=\"progress_"+animalID+"\">"+
              "<div class=\"progress-bar\" role=\"progressbar\" style=\"width: 0%;\" aria-valuenow=\"0\" aria-valuemin=\"0\" aria-valuemax=\"100\">0%</div>"+
            "</div></div></div>"+
        "<div class=\"row\">"+
        "<div class=\"col-xs-6\">";
        for (i in animal_properties) {
            if (animal.type == "critter" && (animal_properties[i] == "sedated" || animal_properties[i] == "sampled")) {
                continue;
            }
            if (animal_properties[i] == "garment set") {
                continue;
            }
            var icon = (data.animals[animalID][animal_properties[i]] == true) ? "check_box" : "check_box_outline_blank";
            html += "<button id=\""+animal_properties[i]+"_"+animalID+"\" class=\"bt_guide\" onclick=\"toggleAnimalProperty("+animalID+", '"+animal_properties[i]+"')\"><i class=\"material-icons\">"+icon+"</i> "+capitalise(animal_properties[i])+"</button>";
        }
        html += "</div>"+
        "<div class=\"col-xs-6\">";

        if (animal.type !== "critter") { 
            html += "<button class=\"bt_undo\" onclick=\"sample("+animalID+", true)\"><i class=\"material-icons\">undo</i> Undo sample</button>"+
            "<button class=\"bt_undo\" onclick=\"stamp("+animalID+", true)\"><i class=\"material-icons\">undo</i> Undo stamp</button>";
        }
        
        if (animal.type == "legendary") { 
            var icon = (data.animals[animalID]["garment_set"] == true) ? "check_box" : "check_box_outline_blank";
            html += "<br clear=\"all\"/><h5 style=\"float: right; line-height: 15px; margin-top: 30px; color: #e1d674 !important;\">Legendary</h5><br clear=\"all\"/><button id=\"garment_set_"+animalID+"\" class=\"bt_guide bt_legend_cool\" onclick=\"toggleAnimalProperty("+animalID+", 'garment_set')\"><i class=\"material-icons\">"+icon+"</i> Garment set</button>"+
            "<br clear=\"all\"/><button class=\"bt_legend_cool\" onclick=\"startCooldown('"+animal.species+"')\"><i class=\"material-icons\">timer</i> Cooldown</button>"+
            "<br clear=\"all\"/><button class=\"bt_legend_cool cooldown cooldown_"+animal.species+"\" onclick=\"stopCooldown('"+animal.species+"')\"><i class=\"material-icons\">timer_off</i> <span></span></button>";
        }

        html += "</div></div></div></div></div></div>";
        if (data.app.settings.show_categories === true) {
            $('#category_'+animal.category+'>.animals').append(html);
        } else {
            $('#category_0>.animals').append(html);
        }

        if (!animal.stamped) {
            $("#stamped_"+animalID).removeClass("bt_stamp_y");
            $("#stamped_"+animalID).addClass("bt_stamp_n");
        }

        styleProgressBar(animalID);
    }
    if (data.app.collapse_shown && data.app.settings.show_categories === true) {
        $(data.app.collapse_shown).collapse('show');
    }

    //Sort animal divs if alphabetic setting is active
    if (data.app.settings.show_alpha === true) {
        $('.category>.animals').each(function() {
            var $animals = $(this),
                $animalsdiv = $animals.children('.container-fluid');
            
            $animalsdiv.sort(function(a,b){
                var an = a.getAttribute('data-animal-name'),
                    bn = b.getAttribute('data-animal-name');
            
                if(an > bn) {
                    return 1;
                }
                if(an < bn) {
                    return -1;
                }
                return 0;
            });
            
            $animalsdiv.detach().appendTo($animals);
        });
    }

    if (data.app.settings.show_categories === true) {
        $('.cat_mini').css('visibility','hidden');
    } else {
        $('.cat_mini').css('visibility','visible');
    }
}

function ocr(image_data) {
    gtag('event','OCR');
    $('#upload-check').html("Processing...");
    var p = {
        "requests": [
          {
            "image": {
              "content": image_data
            },
            "features": [
              {
                "type": "DOCUMENT_TEXT_DETECTION"
              }
            ]
          }
        ]
      };

    $.ajax({
        type: "POST",
        url: "https://vision.googleapis.com/v1/images:annotate?key=AIzaSyCeNgFDd4fR3le82wUuJGa1xVsVgsILF-E",
        data: JSON.stringify(p),

        headers: {
            "Content-Type": "application/json",
        },

        dataType: "json",   
        success: function(ret, textStatus, jqXHR) {
            var ocr_animals = [];
            if (!ret.responses[0].error) {
                $('#upload-check').html("");
                console.log(ret);
                var lines = (ret.responses[0].fullTextAnnotation.text).split('\n');
                for (var i=0; i < lines.length; i++) {
                    console.log(lines[i]);
                    //Some corrections
                    lines[i] = lines[i].replace("0x", "Ox");
                    lines[i] = lines[i].replace("0ld", "Old");
                    lines[i] = lines[i].replace("0possum", "Opossum");
                    lines[i] = lines[i].replace("0nyx", "Onyx");
                    lines[i] = lines[i].replace("0zula", "Ozula");
                    lines[i] = lines[i].replace("0wiza", "Owiza");
                    lines[i] = lines[i].replace("0ta", "Ota");

                    //Check of the text equals an animal name
                    for (a in data.animals) {
                        var nameToCheck = data.animals[a].name;
                        if (data.animals[a].type == "legendary") {
                            var nameToCheck = "Legendary "+nameToCheck;
                        }
                        if (nameToCheck == lines[i] || data.animals[a].fullname == lines[i]) {

                            //Check if the next text is a number, if yes it's part of this one, if no just continue
                            var matches = lines[i+1].match(/\d+/g);
                            if (matches != null && ""+matches != "0") {
                                var num_samples = matches;
                                i++;
                            } else {
                                var num_samples = 1;
                            }

                            
                            var html = '<div class="row"><div class="col-xs-8">'+data.animals[a].name+'</div><div class="col-xs-4"><input type="text" data-animalid="'+a+'" value="'+num_samples+'" /></div></div>';
                            $('#upload-check').append(html);
                        }
                    }
                }
                $('#saveUpload').show();
            } else {
                $('#upload-check').html('');
                $("#upload-control").val('');
                $("#upload").modal('hide');
                $('#saveUpload').hide();
                showNote("Error in Google Vision: "+data.responses[0].error.message);
            }
        },
        error: function(jqXHR) {
            var error = jqXHR.responseJSON.error;
            $('#upload-check').html('');
            $("#upload-control").val('');
            $("#upload").modal('hide');
            $('#saveUpload').hide();
            showNote("Error in Google Vision: "+error.message+" ("+error.code+")");
        }
    });
}

function handleSearch(val) {
    $('.odd').removeClass("odd");
    $('.even').removeClass("even");
    $('.animals>.container-fluid').filter(function() {
        $(this).toggleClass("hidden", !($(this).attr("data-animal-name").toLowerCase().indexOf(val) > -1));
    });
    $('.animals').each(function() {
        var oddeven = "even";
        var children = false;
        $(this).children(".container-fluid:not(.hidden)").each(function() {
            children = true;
            $(this).addClass(oddeven);
            oddeven = (oddeven == "even") ? "odd" : "even";
        });
        $(this).parent().toggleClass("hidden", !children);
    });

    if ($(".category:visible").length == 1 && $(".category:visible").children(".animals:visible").length == 0) {
        toggle($(".category:visible").attr("data-category"));
    }
}

function saveUpload() {
    $('#upload-check input').each(function() {
        data.animals[$(this).data("animalid")].samples = $(this).val();
    });
    $('#upload-check').html('');
    $("#upload-control").val('');
    $("#upload").modal('hide');
    $('#saveUpload').hide();
    commit();
    switchView(false);
    showNote("Updated animal samples from uploaded photo.");
}

function capitalise(s) {
    if (typeof s !== 'string') { return '' }
    return s.charAt(0).toUpperCase() + s.slice(1)
}

function reset() {
    if (confirm("Delete all data? This cannot be undone.")) {
        localStorage.clear();
        location.reload();
    }
    return false;
}
        
window.onfocus = function () {
    isTabActive = true;
    cooldownTimer();
}; 

window.onblur = function () { 
    isTabActive = false; 
};