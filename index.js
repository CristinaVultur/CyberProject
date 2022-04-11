//cu require includem pachetele folosite in proiect
const express = require('express');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {Client} =require('pg');
const url = require('url');
const { exec } = require("child_process");
const ejs=require('ejs');
const session = require('express-session');
const formidable = require('formidable');
const crypto = require('crypto');
const nodemailer = require("nodemailer");
const xmljs = require('xml-js');
const request = require('request');


const html_to_pdf = require('html-pdf-node');

/*Puteti decomenta codul de mai jos pentru a crea un pdf chiar la pornirea programului
pe baza fisierului test.html
*/
// let options = { format: 'A4' };
// let file = { content: fs.readFileSync("./resurse/html/factura-exemplu.html").toString("utf-8") };
// html_to_pdf.generatePdf(file, options).then(function(pdf) {
//   var numefis="temp/test"+(new Date()).getTime()+".pdf";
//   fs.writeFileSync(numefis,pdf);
//   trimitefactura("Le prof", "profprofprof007@gmail.com", numefis);
// });



var app=express();//am creat serverul
app.use(["/produse_cos","/cumpara"],express.json({limit:'2mb'}));//obligatoriu de setat pt request body de tip json
//trec mai jos paginile cu cereri post pe care vreau sa le tratez cu req.body si nu cu formidable
app.use(["/contact"], express.urlencoded({extended:true}));

//setez o sesiune
app.use(session({
  secret: 'abcdefg',//folosit de express session pentru criptarea id-ului de sesiune
  resave: true,
  saveUninitialized: false
}));

//de explicat curs 14
/*const { networkInterfaces } = require('os');
const nets = networkInterfaces();
console.log(nets)
*/




//functii utile

function getUtiliz(req){
	var utiliz;
	if(req.session){
		utiliz=req.session.utilizator
	}
	else{utiliz=null}
	return utiliz;
}


async function trimiteMail(username, email){
	var transp= nodemailer.createTransport({
		service: "gmail",
		secure: false,
		auth:{//date login 
			user:"test.tweb.node@gmail.com",
			pass:"tehniciweb"
		},
		tls:{
			rejectUnauthorized:false
		}
	});
	//genereaza html
	await transp.sendMail({
		from:"test.tweb.node@gmail.com",
		to:email,
		subject:"Te-ai inregistrat cu succes",
		text:"Username-ul tau este "+username,
		html:"<h1>Salut!</h1><p>Username-ul tau este "+username+"</p>",
	})
	console.log("trimis mail");
}

async function trimitefactura(username, email,numefis){
	var transp= nodemailer.createTransport({
		service: "gmail",
		secure: false,
		auth:{//date login 
			user:"test.tweb.node@gmail.com",
			pass:"tehniciweb"
		},
		tls:{
			rejectUnauthorized:false
		}
	});
	//genereaza html
	await transp.sendMail({
		from:"test.tweb.node@gmail.com",
		to:email,
		subject:"Factură",
		text:"Stimate "+username+", aveți atașată factura",
		html:"<h1>Salut!</h1><p>Stimate "+username+", aveți atașată factura</p>",
        attachments: [
            {   // utf-8 string as an attachment
                filename: 'factura.pdf',
                content: fs.readFileSync(numefis)
            }]
	})
	console.log("trimis mail");
}




//setam datele clentului PostgreSQL
//trebuie sa inlocuiti cu username-ul vostru si parola voastra pentru userul creat special pentru acest proiect
const client = new Client({
    host: 'localhost',
    user: 'postgres',
    password: 'pass',
    database: 'db_test',
    port:5432
})
client.connect()



app.set("view engine","ejs");//setez ca motor de template ejs
console.log("Proiectul se afla la ",__dirname);//__dirname e folderul proiectului (variabila implicit setata de node)
app.use("/resurse",express.static(__dirname+"/resurse"));//setez folderul de resurse ca static, ca sa caute fisierele in el, in urma cererilor
/*
app.use(/\.js/ , function(req,res){
    res.setHeader('content-type', 'text/js');
});*/

setInterval(function(){
    let comanda= `delete from accesari where now() - data_accesare > interval '10 minutes'`;
    //console.log(comanda);
    client.query(comanda, function(err, rez){
        if(err) console.log(err);
    });
},10*60*1000)


app.use(function(req,res, next){
    let comanda_param= `insert into accesari(ip, user_id, pagina) values ($1::text, $2,  $3::text)`;
    //console.log(comanda);
    if (req.ip){
        var id_utiliz=req.session.utilizator?req.session.utilizator.id:null;
        console.log("id_utiliz", id_utiliz);
        client.query(comanda_param, [req.ip, id_utiliz, req.url], function(err, rez){
            if(err) console.log(err);
        });
    }
    next();
});





function verificaImagini(){
	var textFisier=fs.readFileSync("resurse/json/galerie.json") //citeste tot fisierul
	var jsi=JSON.parse(textFisier); //am transformat in obiect

	var caleGalerie=jsi.cale_galerie;
    let vectImagini=[]
	for (let im of jsi.imagini){
		var imVeche= path.join(caleGalerie, im.fisier);//obtin claea completa (im.fisier are doar numele fisierului din folderul caleGalerie)
		var ext = path.extname(im.fisier);//obtin extensia
		var numeFisier =path.basename(im.fisier,ext)//obtin numele fara extensie
		let imNoua=path.join(caleGalerie+"/mic/", numeFisier+"-mic"+".webp");//creez cale apentru imaginea noua; prin extensia wbp stabilesc si tipul ei
		//console.log(imNoua);
        vectImagini.push({mare:imVeche, mic:imNoua, descriere:im.descriere}); //adauga in vector un element
		if (!fs.existsSync(imNoua))//daca nu exista imaginea, mai jos o voi crea
		sharp(imVeche)
		  .resize(150) //daca dau doar width(primul param) atunci height-ul e proportional
		  .toFile(imNoua, function(err) {
              if(err)
			    console.log("eroare conversie",imVeche, "->", imNoua, err);
		  });
	}
    // [ {mare:cale_img_mare, mic:cale_img_mica, descriere:text}, {mare:cale_img_mare, mic:cale_img_mica, descriere:text}, {mare:cale_img_mare, mic:cale_img_mica, descriere:text}  ]
    return vectImagini;
}



app.get(["/","/index"],function(req, res){//ca sa pot accesa pagina principala si cu localhost:8080 si cu localhost:8080/index
    var rezultat;
    client.query("select username from utilizatori where id in (select distinct user_id from accesari where now() - data_accesare < interval '10 minutes' )").then(function(rezultat){
        console.log("rezultat", rezultat.rows);

        var locatie="";
        request('https://secure.geobytes.com/GetCityDetails?key=7c756203dbb38590a66e01a5a3e1ad96&fqcn=109.99.96.15', 
            function (error, response, body) {
            if(error) {console.error('error:', error)}
            else{
                var obiectLocatie=JSON.parse(body);
                locatie=obiectLocatie.geobytescountry+" "+obiectLocatie.geobytesregion
            }

            /*generare evenimente random pentru calendar */
            var evenimente=[]
            var texteEvenimente=["Eveniment important", "Festivitate", "Prajituri gratis", "Zi cu soare", "Aniversare"];
            dataCurenta=new Date();
            for(i=0;i<5;i++){
                evenimente.push({data: new Date(dataCurenta.getFullYear(), dataCurenta.getMonth(), Math.ceil(Math.random()*25) ), text:texteEvenimente[i]});
            }
            console.log(evenimente)
            res.render("pagini/index", {evenimente: evenimente, locatie:locatie,utiliz_online: rezultat.rows, imagini: verificaImagini(), utilizator: req.session.utilizator});
            
            });

         
    }, function(err){console.log("eroare",err)});
    
});

app.post("/login", function(req,res){
    let formular= formidable.IncomingForm();
    formular.parse(req, function(err, campuriText){
        //console.log(campuriText);
        let parolaCriptata= crypto.scryptSync(campuriText.parola, parolaServer, 32).toString('ascii');
        //let comanda= `select username, nume,email, culoare_chat, rol from utilizatori where username= '${campuriText.username}' and parola='${parolaCriptata}'`;
        let comanda_param= `select id,username,nume, email, culoare_chat, rol from utilizatori where username= $1::text and parola=$2::text`;
        //console.log(comanda);
        
        client.query(comanda_param, [campuriText.username, parolaCriptata], function(err, rez){
        //client.query(comanda, function(err, rez){
            if (!err){
                //console.log(rez);
                if (rez.rows.length == 1){
                    req.session.utilizator={
                        id:rez.rows[0].id,
                        username:rez.rows[0].username,
                        nume:rez.rows[0].nume,
                        email:rez.rows[0].email,
                        culoare_chat:rez.rows[0].culoare_chat,
						rol:rez.rows[0].rol
                    }
                }
                
            }
            res.redirect("/index");
        });
    }); 
})



app.get("*/galerie-animata.css",function(req, res){
    /*Atentie modul de rezolvare din acest app.get() este strict pentru a demonstra niste tehnici
    si nu pentru ca ar fi cel mai eficient mod de rezolvare*/
    res.setHeader("Content-Type","text/css");//pregatesc raspunsul de tip css
    let sirScss=fs.readFileSync("./resurse/scss/galerie_animata.scss").toString("utf-8");//citesc scss-ul cs string
    culori=["navy","black","purple","grey"]
    let culoareAleatoare =culori[Math.floor(Math.random()*culori.length)];//iau o culoare aleatoare pentru border
    let rezScss=ejs.render(sirScss,{culoare:culoareAleatoare});// transmit culoarea catre scss si obtin sirul cu scss-ul compilat
    //console.log(rezScss);
    fs.writeFileSync("./temp/galerie-animata.scss",rezScss);//scriu scss-ul intr-un fisier temporar
    exec("sass ./temp/galerie-animata.scss ./temp/galerie-animata.css", function(error, stdout, stderr) {//execut comanda sass (asa cum am executa in cmd sau PowerShell)
        if (error) {
            console.log(`error: ${error.message}`);
            res.end();//termin transmisiunea in caz de eroare
            return;
        }
        if (stderr) {
            console.log(`stderr: ${stderr}`);
            res.end();
            return;
        }
        //console.log(`stdout: ${stdout}`);
        
        //totul a fost bine, trimit fisierul rezultat din compilarea scss
        res.sendFile(path.join(__dirname,"temp/galerie-animata.css"));
    });

});
app.get("*/galerie-animata.css.map",function(req, res){
    res.sendFile(path.join(__dirname,"temp/galerie-animata.css.map"));
});

app.get("/ceva",function(req, res){

    res.setHeader("Content-Type","text/html");
    res.write("<!DOCTYPE html><html><head><title>ceva</title></head><body>"+ new Date() +"</body></html>");//cod html creat pe loc

});
app.get("/produse",function(req, res){
    //console.log("Url:",req.url);
    //console.log("Query:", req.query.tip);
    // conditie_booleana? val_true : val_false
    let conditie= req.query.tip ?  " and tip_produs='"+req.query.tip+"'" : "";//daca am parametrul tip in cale (tip=cofetarie, de exemplu) adaug conditia pentru a selecta doar produsele de acel tip
    console.log("select id, nume, pret, gramaj, calorii, categorie, imagine from prajituri where 1=1"+conditie);
    client.query("select id, nume, pret, gramaj, calorii, categorie, imagine from prajituri where 1=1"+conditie, function(err,rez){
        console.log(err, rez);
        //console.log(rez.rows);
        client.query("select unnest(enum_range( null::categ_prajitura)) as categ", function(err,rezCateg){//selectez toate valorile posibile din enum-ul categ_prajitura

            console.log(rezCateg);
            res.render("pagini/produse", {produse:rez.rows, categorii:rezCateg.rows, utilizator: req.session.utilizator});//obiectul {a:10,b:20} poarta numele locals in ejs  (locals["a"] sau locals.a)
            });
        
       
    });

    
});


//-----------------cos virtual ------------------------
app.post("/produse_cos",function(req, res){
    
	console.log("req.body: ",req.body);
    console.log(req.get("Content-type"));
    console.log("body: ",req.get("body"));

    /* prelucrare pentru a avea toate id-urile numerice si pentru a le elimina pe cele care nu sunt numerice */
    var iduri=[]
    for (let elem of req.body.ids_prod){
        let num=parseInt(elem);
        if (!isNaN(num))
            iduri.push(num);
    }
    if (iduri.length==0){
        res.send("eroare");
        return;
    }

    console.log("select id, nume, pret, gramaj, calorii, categorie, imagine from prajituri where id in ("+iduri+")");
    client.query("select id, nume, pret, gramaj, calorii, categorie, imagine from prajituri where id in ("+iduri+")", function(err,rez){
        console.log(err, rez);
        //console.log(rez.rows);
        res.send(rez.rows);
       
       
    });

    
});


app.post("/cumpara",function(req, res){
    if(!req.session.utilizator){
        res.write("Nu puteti cumpara daca nu sunteti logat!");res.end();
        return;
    }
    console.log("select id, nume, pret, gramaj, calorii, categorie, imagine from prajituri where id in ("+req.body.ids_prod+")");
    client.query("select id, nume, pret, gramaj, calorii, categorie, imagine from prajituri where id in ("+req.body.ids_prod+")", function(err,rez){
        console.log(err, rez);
        //console.log(rez.rows);
        console.log(req.session.utilizator);
        let rezFactura=ejs.render(fs.readFileSync("views/pagini/factura.ejs").toString("utf-8"),{utilizator:req.session.utilizator,produse:rez.rows});
        console.log(rezFactura);
        let options = { format: 'A4' };

        let file = { content: rezFactura };

        html_to_pdf.generatePdf(file, options).then(function(pdf) {
            var numefis="temp/test"+(new Date()).getTime()+".pdf";
            fs.writeFileSync(numefis,pdf);
            trimitefactura(req.session.utilizator.username, req.session.utilizator.email, numefis);
            res.write("Totu bine!");res.end();
        });
       
        
       
    });

    
});





//pagina proprie produsului
app.get("/produs/:id_prajitura",function(req, res){
    console.log(req.params);
    
    const rezultat= client.query("select * from prajituri where id="+req.params.id_prajitura, function(err,rez){
        //console.log(err, rez);
        console.log(rez.rows);
        res.render("pagini/produs", {prod:rez.rows[0], utilizator: req.session.utilizator});//obiectul {a:10,b:20} poarta numele locals in ejs  (locals["a"] sau locals.a)
    });

    
});

let parolaServer="tehniciweb";
app.post("/inreg",function(req, res){ 
    console.log("primit date");
    var username;
    let formular= formidable.IncomingForm();
	//nr ordine: 4
    formular.parse(req, function(err, campuriText, campuriFisier){
        console.log(campuriText);
		eroare ="";
		if(campuriText.username=="" || !campuriText.username.match("^[A-Za-z0-9]+$")){
			eroare+="Username gresit. ";
		}
		if(!eroare){
			let parolaCriptata= crypto.scryptSync(campuriText.parola, parolaServer, 32).toString('ascii');
			let comanda= `insert into utilizatori (username, nume, prenume, parola, email, culoare_chat) values ('${campuriText.username}','${campuriText.nume}', '${campuriText.prenume}', '${parolaCriptata}', '${campuriText.email}', '${campuriText.culoareText}')`;
			console.log(comanda);
			client.query(comanda, function(err, rez){
				if (err){
					console.log(err);
					res.render("pagini/inregistrare",{err:"Eroare baza date! Reveniti mai tarziu", raspuns:"Datele nu au fost introdduse."});
				}
				else{
					res.render("pagini/inregistrare",{err:"", raspuns:"Totu bine!"});
					trimiteMail(campuriText.username,campuriText.email);
					console.log(campuriText.email);
				}
			});
		}
		else{
					res.render("pagini/inregistrare",{err:"Eroare formular. "+eroare, raspuns:""});
		}
    });
	
	//nr ordine: 2
	formular.on("fileBegin", function(name,campFisier){
		console.log("inceput upload: ", campFisier);
		if(campFisier && campFisier.name!=""){
			//am  fisier transmis
			var cale=__dirname+"/poze_uploadate/"+username
			if (!fs.existsSync(cale))
				fs.mkdirSync(cale);
			campFisier.path=cale+"/"+campFisier.name;
			console.log(campFisier.path);
		}
	});	
	
	
	//nr ordine: 1
	formular.on("field", function(name,field){
		if(name=='username')
			username=field;
		console.log("camp - field:", name)
	});
	

	
	//nr ordine: 3
	formular.on("file", function(name,field){
		console.log("final upload: ", name);
	});
	
	
	
	
});


//-------------------------------- contact ---------------------------------------
caleXMLMesaje="resurse/xml/contact.xml";
headerXML=`<?xml version="1.0" encoding="utf-8"?>`;
function creeazaXMlContactDacaNuExista(){
    if (!fs.existsSync(caleXMLMesaje)){
        let initXML={
            "declaration":{
                "attributes":{
                    "version": "1.0",
                    "encoding": "utf-8"
                }
            },
            "elements": [
                {
                    "type": "element",
                    "name":"contact",
                    "elements": [
                        {
                            "type": "element",
                            "name":"mesaje",
                            "elements":[]                            
                        }
                    ]
                }
            ]
        }
        let sirXml=xmljs.js2xml(initXML,{compact:false, spaces:4});
        console.log(sirXml);
        fs.writeFileSync(caleXMLMesaje,sirXml);
        return false; //l-a creat
    }
    return true; //nu l-a creat acum
}


function parseazaMesaje(){
    let existaInainte=creeazaXMlContactDacaNuExista();
    let mesajeXml=[];
    let obJson;
    if (existaInainte){
        let sirXML=fs.readFileSync(caleXMLMesaje, 'utf8');
        obJson=xmljs.xml2js(sirXML,{compact:false, spaces:4});
        

        let elementMesaje=obJson.elements[0].elements.find(function(el){
                return el.name=="mesaje"
            });
        let vectElementeMesaj=elementMesaje.elements?elementMesaje.elements:[];
        console.log("Mesaje: ",obJson.elements[0].elements.find(function(el){
            return el.name=="mesaje"
        }))
        let mesajeXml=vectElementeMesaj.filter(function(el){return el.name=="mesaj"});
        return [obJson, elementMesaje,mesajeXml];
    }
    return [obJson,[],[]];
}


app.get("/contact", function(req, res){
    let obJson, elementMesaje, mesajeXml;
    [obJson, elementMesaje, mesajeXml] =parseazaMesaje();

    res.render("pagini/contact",{ utilizator:req.session.utilizator, mesaje:mesajeXml})
});

app.post("/contact", function(req, res){
    let obJson, elementMesaje, mesajeXml;
    [obJson, elementMesaje, mesajeXml] =parseazaMesaje();
        
    let u= req.session.utilizator?req.session.utilizator.username:"anonim";
    let mesajNou={
        type:"element", 
        name:"mesaj", 
        attributes:{
            username:u, 
            data:new Date()
        },
        elements:[{type:"text", "text":req.body.mesaj}]
    };
    if(elementMesaje.elements)
        elementMesaje.elements.push(mesajNou);
    else 
        elementMesaje.elements=[mesajNou];
    console.log(elementMesaje.elements);
    let sirXml=xmljs.js2xml(obJson,{compact:false, spaces:4});
    console.log("XML: ",sirXml);
    fs.writeFileSync("resurse/xml/contact.xml",sirXml);
    
    res.render("pagini/contact",{ utilizator:req.session.utilizator, mesaje:elementMesaje.elements})
});




//-------------------------------- actiunile admin-ului: afisare si stergere utilizator ---------------------------------------

app.get('/useri', function(req, res){
	
	if(req.session && req.session.utilizator && req.session.utilizator.rol=="admin"){
        client.query("select * from utilizatori",function(err, rezultat){
            if(err) throw err;
            console.log(rezultat);
            res.render('pagini/useri',{useri:rezultat.rows, utilizator:req.session.utilizator});//afisez index-ul in acest caz
        });
	} else{
		res.status(403).render('pagini/eroare',{mesaj:"Nu aveti acces", utilizator:req.session.utilizator});
	}

});

app.post("/sterge_utiliz",function(req, res){
	if(req.session && req.session.utilizator && req.session.utilizator.rol=="admin"){
	var formular= formidable.IncomingForm()
	
	formular.parse(req, function(err, campuriText, campuriFisier){
		var comanda=`delete from utilizatori where id='${campuriText.id_utiliz}'`;
		client.query(comanda, function(err, rez){
			// TO DO mesaj cu stergerea
		});
	});
	}
	res.redirect("/useri");
	
});


app.get("/logout", function(req, res){
    req.session.destroy();
    res.render("pagini/logout");
});

app.get("/*",function(req, res){    
    res.render("pagini"+req.url, {utilizator: req.session.utilizator}, function(err,rezultatRandare){
        if(err){
            if(err.message.includes("Failed to lookup view")){
                res.status(404).render("pagini/404", {utilizator: req.session.utilizator});
            }
            else{ 
                console.log("Eroare pentru:", req.url);
                throw err;
            }
        }
        else{
            res.send(rezultatRandare);
        }
    });
});


verificaImagini();

app.listen(8080);
console.log("Serverul a pornit!");
