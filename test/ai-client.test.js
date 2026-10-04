const {test}=require('node:test');
const assert=require('node:assert/strict');
const {complete,endpoint}=require('../services/ai-client');
const config={baseUrl:'https://token.sensenova.cn/v1',apiKey:'test-only-placeholder',model:'deepseek-v4-flash',enableThinking:false};
test('商汤文字与图像使用正确模型、Base64 内容和正式答案',async()=>{
  const realFetch=global.fetch;let request;
  global.fetch=async(url,options)=>{request={url,options,body:JSON.parse(options.body)};return Response.json({choices:[{message:{content:'识别结果：积分题',reasoning:'不显示的内部推理'}}]});};
  try {
    const content=[{type:'text',text:'讲解图片'},{type:'image_url',image_url:{url:'data:image/png;base64,cGl4ZWw='}}];
    assert.equal(await complete([{role:'user',content}],{config}),'识别结果：积分题');
    assert.equal(request.url,'https://token.sensenova.cn/v1/chat/completions');assert.equal(request.body.model,'sensenova-6.8-flash-lite');assert.equal(request.body.reasoning_effort,'none');assert.deepEqual(request.body.messages[0].content,content);
    await complete([{role:'user',content:'文字题'}],{config});assert.equal(request.body.model,'deepseek-v4-flash');
    await complete([{role:'user',content}],{config:{...config,visionModel:'custom-vision'}});assert.equal(request.body.model,'custom-vision');
    assert.equal(endpoint(config.baseUrl+'/chat/completions'),request.url);
  } finally {global.fetch=realFetch;}
});
test('拆分的 SSE 中文、末行与思考字段处理正确，空答复和失败明确报错',async()=>{
  const realFetch=global.fetch;
  try {
    const data='data: '+JSON.stringify({choices:[{delta:{reasoning_content:'隐藏内容'}}]})+'\n\n'+'data: '+JSON.stringify({choices:[{delta:{content:'答案：'}}]})+'\r\n\r\n'+'data: '+JSON.stringify({choices:[{delta:{content:'这是中文。'}}]});
    const bytes=new TextEncoder().encode(data);global.fetch=async()=>new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=5)c.enqueue(bytes.slice(i,i+5));c.close();}}),{headers:{'Content-Type':'text/event-stream'}});
    let text='';assert.equal(await complete([{role:'user',content:'题目'}],{config,onDelta:d=>text+=d}),'答案：这是中文。');assert.equal(text,'答案：这是中文。');
    global.fetch=async()=>Response.json({choices:[{message:{reasoning:'只有思考'}}]});await assert.rejects(complete([{role:'user',content:'题目'}],{config}),/正式答复/);
    global.fetch=async()=>new Response('不要回显原始密钥错误',{status:401});await assert.rejects(complete([{role:'user',content:'题目'}],{config}),/HTTP 401/);
  } finally {global.fetch=realFetch;}
});
