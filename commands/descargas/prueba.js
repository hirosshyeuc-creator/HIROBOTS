const express = require("express")
const axios = require("axios")

const app = express()
const PORT = 3000

// endpoint para convertir youtube a mp3
app.get("/play", async (req, res) => {
try {

const url = req.query.url

if(!url){
return res.json({
status:false,
message:"Falta la URL de YouTube"
})
}

// codificar url para evitar errores
const apiUrl = `https://0f66da8bd81e5d32-201-230-121-168.serveousercontent.com/ytmp3?url=${encodeURIComponent(url)}`

// llamar a tu api
const response = await axios.get(apiUrl,{
timeout:20000
})

const data = response.data

if(!data || !data.download){
return res.json({
status:false,
message:"La API no devolvió audio"
})
}

// enviar resultado
res.json({
status:true,
audio:data.download
})

}catch(err){

console.log(err.message)

res.json({
status:false,
message:"Error al procesar el video"
})

}

})

app.listen(PORT,()=>{
console.log("Servidor corriendo en puerto "+PORT)
})
