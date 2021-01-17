var data = {};
        
$( document ).ready(function() {
    if (localStorage.getItem("rdonaturalist")) {
        data = JSON.parse(localStorage.getItem("rdonaturalist"));

    } else {
        data = init_data;
    }

    migrateData();

    //Select the view, to build the DOM
    $("select#view").val(data.app.view);
    $("select#view").trigger('change');

    //Update settings on opening settings modal
    $('#settings').on('show.bs.modal', function (e) {
         $("#set_categories").prop( "checked", data.app.settings.show_categories);
         $("#set_alpha").prop( "checked", data.app.settings.show_alpha);
         $("#set_critters").prop( "checked", data.app.settings.show_critters);
         $("#set_legend").prop( "checked", data.app.settings.show_legend);
         $("#set_sedatedOnSample").prop( "checked", data.app.settings.sedatedOnSample);
    });

    if (!data.app.help_shown) {
        $("#help").modal('show');

        data.app.help_shown = true;
        commit();
    }
});

function commit() {
    localStorage.setItem("rdonaturalist", JSON.stringify(data));
}

function toggle(category) {
    $('.animals').collapse('hide');
    $('#category_'+category+'>.animals').collapse('show');

    data.app.collapse_shown = '#category_'+category+'>.animals';
    commit();
}

function toggle_animal(animal) {
    $('.animal').collapse('hide');
    $('#animal_'+animal+'>.animal').collapse('show');

    data.app.collapse_shown_animal = '#animal_'+animal+'>.animal';
    commit();
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
    return false;
}

function sample(animalID, undo=false) {
    if ((data.animals[animalID].samples == 10 && !undo) || (data.animals[animalID].samples == 0 && undo)) {
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
    }

    commit();
    styleRows();
    styleCategories();

    if(!undo) {
        showNote("Sampled "+data.animals[animalID].name+".");
    } else {
        showNote("Undid sampling "+data.animals[animalID].name+".");
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
    } else {
        showNote("Undid stamping "+data.animals[animalID].name+".");
    }
    return false;
}

function toggleAnimalProperty(animalID, property) {
    data.animals[animalID][property] = !data.animals[animalID][property];
    
    var icon = (data.animals[animalID][property] == true) ? "check_box" : "check_box_outline_blank";
    $("#"+property+"_"+animalID+" i").html(icon);

    styleProgressBar(animalID);
    commit();
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
    var totalProps=0;
    for (i in animal_properties) {
        totalProps ++;
        if (data.animals[animalID][animal_properties[i]] === true) {
            props++;
        }
    }
    var perc = Math.round((props / totalProps) * 100); 
    $("#progress_"+animalID+">.progress-bar").css("width", perc+"%").html(perc+"%").attr("aria-valuenow",perc);
}

function saveSettings() {
    data.app.settings.show_categories = $("#set_categories").prop("checked");
    data.app.settings.show_alpha = $("#set_alpha").prop("checked");
    data.app.settings.show_critters = $("#set_critters").prop("checked");
    data.app.settings.show_legend = $("#set_legend").prop("checked");
    data.app.settings.sedatedOnSample = $("#set_sedatedOnSample").prop("checked");     
    commit();

    switchView();
}

function switchView() {
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
    } else {
        $('#nothingtosee').hide();
    }

    data.app.view = view;
    styleCategories();
    commit();
    
    return false;
}

function init() {
    $('#category_container').html("");

    //Build category container div
    if (data.app.settings.show_categories === true) {
        for (categoryID in data.categories) {
            var category = data.categories[categoryID];
            var html = 
            "<div class=\"container category\" id=\"category_"+categoryID+"\">"+
                "<div class=\"row title\">"+
                    "<div class=\"col-xs-7\" onclick=\"toggle("+categoryID+")\"><h4><div class=\"cat_image_cont\"><img class=\"cat_image\" src=\"assets/cat"+categoryID+".png\" /><img class=\"cat_image_ex\" src=\"assets/exclamation.png\" /></div>"+category.name+"</h4></div>"+
                    "<div class=\"col-xs-5\">"+
                        "<h4><span id=\"cat_stamped_"+categoryID+"\">"+category.stamped+"</span>/"+category.total+" "+
                        "<input type=\"button\" class=\"bt_rdo bt_tradein\" onclick=\"sell("+categoryID+")\" /></h4>"+ 
                    "</div>"+
                "</div>"+
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

        //Take critter/legendary settings into account
        if (!data.app.settings.show_critters && animal.type == "critter") {
            continue;
        }
        if (!data.app.settings.show_legend && animal.type == "legendary") {
            continue;
        }

        var html = 
        "<div class=\"container-fluid\" data-animal-name=\""+animal.name+"\"><div class=\"row title animalrow "+animal.type+"\" id=\"animal_"+animalID+"\">"+
            "<div class=\"col-xs-7\" onclick=\"toggle_animal("+animalID+")\"><h5>"+animal.name+"</h5></div>"+
            "<div class=\"col-xs-5\"><h5>";

        if (animal.type !== "critter") { 
            html +=
                "<input type=\"button\" class=\"bt_rdo bt_sample_"+animal.samples+"\" id=\"samples_"+animalID+"\" onclick=\"sample("+animalID+")\" /> "+
                "<input type=\"button\" class=\"bt_rdo bt_stamp_y\" id=\"stamped_"+animalID+"\" onclick=\"stamp("+animalID+")\" /> </h5>";
        }

        html +=  "</div>"+
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
            var icon = (data.animals[animalID][animal_properties[i]] == true) ? "check_box" : "check_box_outline_blank";
            html += "<button id=\""+animal_properties[i]+"_"+animalID+"\" class=\"bt_guide\" onclick=\"toggleAnimalProperty("+animalID+", '"+animal_properties[i]+"')\"><i class=\"material-icons\">"+icon+"</i> "+capitalise(animal_properties[i])+"</button>";
        }
        html += "</div>"+
        "<div class=\"col-xs-6\">";

        if (animal.type !== "critter") { 
            html += "<button class=\"bt_undo\" onclick=\"sample("+animalID+", true)\"><i class=\"material-icons\">undo</i> Undo sample</button>"+
            "<button class=\"bt_undo\" onclick=\"stamp("+animalID+", true)\"><i class=\"material-icons\">undo</i> Undo stamp</button></div>";
        }

        html += "</div></div></div></div></div>";
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

function capitalise(s) {
    if (typeof s !== 'string') { return '' }
    return s.charAt(0).toUpperCase() + s.slice(1)
}

function reset() {
    if (confirm("Delete all data? This cannot be undone.")) {
        localStorage.setItem("rdonaturalist", "");
        location.reload();
    }
    return false;
}