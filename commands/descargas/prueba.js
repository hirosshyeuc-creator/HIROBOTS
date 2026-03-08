import fs from "fs";
import path from "path";
import axios from "axios";
import yts from "yt-search";
import { exec } from "child_process";

const API_LIST = [
"https://api.agatz.xyz/api/ytmp3",
"https://api.neoxr.eu/api/youtube/audio"
];

const TMP_DIR = path.join(process.cwd(),"tmp");

if(!fs.existsSync(TMP_DIR))
fs.mkdirSync(TMP_DIR,{recursive:true});

function safeFileName(name){
return String(name||"audio")
.replace(/[\\/:*?"<>|]/g,"")
.slice(0,80)
}

async function searchVideo(query){

const res = await yts(query);

if(!res.videos.length) return null;

return res.videos[0];

}

async function getAudio(url){

for(const api of API_LIST){

try{

const {data} = await axios.get(api,{
params:{url}
});

if(data?.data?.url)
return data.data.url;

}catch{}

}

throw new Error("No se pudo obtener audio");

}

function convert(input,output){

return new Promise((resolve,reject)=>{

const cmd = `ffmpeg -y -i "${input}" -vn -ar 44100 -ac 2 -b:a 128k "${output}"`;

exec(cmd,(err)=>{
if(err) reject(err);
else resolve();
});

});

}

export default {

command:["play5"],
category:"descarga",

run: async(ctx)=>{

const {sock,from,args} = ctx;
const msg = ctx.m || ctx.msg;

if(!args.length)
return sock.sendMessage(from,{text:"❌ Uso: .play canción"});

let tempFile;
let finalFile;

try{

const query = args.join(" ");

const video = await searchVideo(query);

if(!video)
return sock.sendMessage(from,{text:"❌ No encontré resultados"});

await sock.sendMessage(from,{
image:{url:video.thumbnail},
caption:`🎵 Descargando\n\n${video.title}`
},{quoted:msg});

const audioUrl = await getAudio(video.url);

tempFile = path.join(TMP_DIR,Date.now()+".mp4");
finalFile = path.join(TMP_DIR,Date.now()+".mp3");

const res = await axios({
url:audioUrl,
method:"GET",
responseType:"stream"
});

const writer = fs.createWriteStream(tempFile);

res.data.pipe(writer);

await new Promise(r=>writer.on("finish",r));

await convert(tempFile,finalFile);

await sock.sendMessage(from,{
audio:{url:finalFile},
mimetype:"audio/mpeg",
fileName:safeFileName(video.title)+".mp3"
},{quoted:msg});

}catch(e){

console.log("PLAY ERROR:",e);

sock.sendMessage(from,{
text:"❌ Error al descargar música"
});

}finally{

try{if(tempFile)fs.unlinkSync(tempFile)}catch{}
try{if(finalFile)fs.unlinkSync(finalFile)}catch{}

}

}

};
