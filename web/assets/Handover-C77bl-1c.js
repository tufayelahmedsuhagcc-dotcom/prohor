import{i as j,u as w,r as l,j as e,N as S,P as u,S as E,f as m,b as o,v as N,x as g,R as d,d as R}from"./index-HXG3lc-o.js";import{D as A}from"./download-CDdHa0Oj.js";/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const I=j("Copy",[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const O=j("Printer",[["path",{d:"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2",key:"143wyd"}],["path",{d:"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6",key:"1itne7"}],["rect",{x:"6",y:"14",width:"12",height:"8",rx:"1",key:"1ue0tg"}]]);function f(){const t=w(),[n,v]=l.useState(""),[r,b]=l.useState(""),[i,y]=l.useState(""),c=t.assessments.filter(s=>s.state==="watch"),h=t.assessments.filter(s=>!s.current||s.current.quality!=="valid"),x=()=>({project:"PROHOR",version:"3.0.0",generatedAt:new Date().toISOString(),purpose:"Non-diagnostic research review packet. Not sent to any recipient.",mode:t.mode==="demo"?"SYNTHETIC DEMONSTRATION":"LOCAL USER INPUT · UNVERIFIED",crew:t.crew,missionDay:t.day,rule:d,situation:n,background:r,request:i,assessments:t.assessments,actions:t.store.actions.filter(s=>s.mode===t.mode&&s.day===t.day&&s.crew===t.crew),sources:Object.values(R),limitations:["Not a medical device or clinical assessment.","Prototype change rules are not clinically validated.","No diagnosis, prescription, radiation dose or fitness-for-duty decision.","Absence of a flag is not evidence of good health.","Historical NASA studies do not become personal clinical thresholds."]}),p=()=>{const s=x();return`PROHOR · CREW REVIEW PACKET
${s.mode}
Flight day ${t.day} · ${t.crew}
Generated ${s.generatedAt}
Rule: ${d}

SITUATION
${n||"Not provided."}
${c.length} rule-level changes; ${h.length} unavailable or invalid indicators.

BACKGROUND
${r||"Not provided."}

OBSERVATIONS (NOT A DIAGNOSIS)
${t.assessments.map(a=>`${o[a.signal].label}: ${N(a.current?.value,a.signal)} ${o[a.signal].unit} | ${g[a.state]} | median ${a.baseline?.median??"not established"} | prior days ${a.baseline?.n??"insufficient"}`).join(`
`)}

REQUEST FOR REVIEW
${i||"Not provided."}

LIMITATIONS
${s.limitations.join(`
`)}

No message has been transmitted. Follow mission-approved emergency procedures for urgent concerns.
`};return e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"page-heading no-print",children:[e.jsxs("div",{children:[e.jsx("span",{className:"eyebrow",children:"CLEAR CONTEXT / HUMAN REVIEW"}),e.jsxs("h1",{children:["A better handover, ",e.jsx("span",{children:"not an automated diagnosis."})]}),e.jsx("p",{children:"Prepare a structured review packet. Your free-text notes are retained only while this page is open; export to keep them."})]}),e.jsxs("button",{className:"button secondary",onClick:()=>window.print(),children:[e.jsx(O,{size:16}),"Print / save PDF"]})]}),e.jsxs(S,{children:[e.jsx("strong",{children:"Nothing is sent."})," This tool does not contact a flight surgeon, emergency service or mission control. Review and share the export through your approved channel. Do not include identifying information."]}),e.jsxs("div",{className:"two-columns handover-grid",children:[e.jsxs(u,{className:"no-print",children:[e.jsx(E,{title:"Add the human context",eyebrow:"OPTIONAL · MAX 1500 CHARACTERS EACH"}),e.jsxs("label",{className:"field",children:["Situation",e.jsx("textarea",{rows:4,maxLength:1500,value:n,onChange:s=>v(s.target.value),placeholder:"What changed, and what prompted this review?"})]}),e.jsxs("label",{className:"field",children:["Background",e.jsx("textarea",{rows:4,maxLength:1500,value:r,onChange:s=>b(s.target.value),placeholder:"Measurement context, workload, repeat readings…"})]}),e.jsxs("label",{className:"field",children:["Request for review",e.jsx("textarea",{rows:4,maxLength:1500,value:i,onChange:s=>y(s.target.value),placeholder:"What do you want the reviewer to consider?"})]}),e.jsxs("div",{className:"report-buttons",children:[e.jsxs("button",{className:"button primary",onClick:()=>m(`prohor-review-FD${t.day}.txt`,p(),"text/plain;charset=utf-8"),children:[e.jsx(A,{size:15}),"Download report"]}),e.jsx("button",{className:"button secondary",onClick:()=>m(`prohor-evidence-FD${t.day}.json`,JSON.stringify(x(),null,2)),children:"Evidence JSON"}),e.jsxs("button",{className:"button secondary",onClick:async()=>{try{await navigator.clipboard.writeText(p()),t.toast("Report copied. Nothing has been sent.")}catch{t.toast("Clipboard permission unavailable. Use Download report instead.")}},children:[e.jsx(I,{size:15}),"Copy"]})]})]}),e.jsxs(u,{className:"report-preview",children:[e.jsxs("div",{className:"report-brand",children:[e.jsx("img",{src:"/icons/mark.svg",alt:""}),e.jsxs("strong",{children:["PROHOR ",e.jsx("span",{children:"/ REVIEW PACKET"})]})]}),e.jsx("h2",{children:"Crew health review"}),e.jsxs("p",{children:["FD ",t.day," · ",t.crew," ·"," ",t.mode==="demo"?"SYNTHETIC DEMONSTRATION":"LOCAL INPUT · UNVERIFIED"]}),e.jsxs("div",{className:"report-block",children:[e.jsx("span",{className:"eyebrow",children:"S / SITUATION"}),e.jsx("p",{children:n||"No additional situation entered."}),e.jsxs("strong",{children:[c.length," indicators changed · ",h.length," unavailable / invalid"]})]}),e.jsxs("div",{className:"report-block",children:[e.jsx("span",{className:"eyebrow",children:"B / BACKGROUND"}),e.jsx("p",{children:r||"No additional background entered."})]}),e.jsxs("div",{className:"report-block",children:[e.jsx("span",{className:"eyebrow",children:"A / OBSERVATIONS — NOT A CLINICAL ASSESSMENT"}),e.jsx("div",{className:"table-scroll",tabIndex:0,role:"region","aria-label":"Scrollable data table",children:e.jsxs("table",{children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Indicator"}),e.jsx("th",{children:"Value"}),e.jsx("th",{children:"State"})]})}),e.jsx("tbody",{children:t.assessments.map(s=>e.jsxs("tr",{children:[e.jsx("td",{children:o[s.signal].short}),e.jsxs("td",{children:[N(s.current?.value,s.signal)," ",o[s.signal].unit]}),e.jsx("td",{children:g[s.state]})]},s.signal))})]})})]}),e.jsxs("div",{className:"report-block",children:[e.jsx("span",{className:"eyebrow",children:"R / REQUEST FOR REVIEW"}),e.jsx("p",{children:i||"No specific request entered."})]}),e.jsxs("p",{className:"small muted",children:["Rule ",d,". Includes personal-baseline context, not clinical thresholds. No diagnosis or treatment decision. No NASA endorsement."]})]})]})]})}export{f as Handover};
