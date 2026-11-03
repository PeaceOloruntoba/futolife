import fs from "node:fs";
const path="src/components/social-hub.tsx";
let source=fs.readFileSync(path,"utf8");
const replacements=[
  ['{(likes[post.id]??[]).includes(me.id)?"♥":"♡"} {(likes[post.id]??[]).length} · Like','<FiHeart className={(likes[post.id]??[]).includes(me.id)?"liked-icon":""} fill={(likes[post.id]??[]).includes(me.id)?"currentColor":"none"}/> {(likes[post.id]??[]).length} · Like'],
  ['<span>▢ {postComments.length} comments</span>','<span><FiMessageCircle/> {postComments.length} comments</span>'],
  ['＋ Add friend','<FiPlus/> Add friend'],
  ['<button aria-label="Send comment" disabled={busy}>{busy?"…":"↗"}</button>','<button aria-label="Send comment" disabled={busy}>{busy?"…":<FiArrowUpRight/>}</button>'],
  ['📄 {message.attachment_name}','<FiFileText/> {message.attachment_name}'],
  ['{pendingAttachment.kind==="image"?"🖼️":pendingAttachment.kind==="video"?"🎬":pendingAttachment.kind==="voice"?"🎙️":"📄"} {pendingAttachment.file.name}','{pendingAttachment.kind==="image"?<FiImage/>:pendingAttachment.kind==="video"?<FiVideo/>:pendingAttachment.kind==="voice"?<FiMic/>:<FiFileText/>} {pendingAttachment.file.name}'],
  ['aria-label="Remove attachment" onClick={()=>setPendingAttachment(null)}>×</button>','aria-label="Remove attachment" onClick={()=>setPendingAttachment(null)}><FiX/></button>'],
  ['title="Attach image, video or document">＋<input','title="Attach image, video or document"><FiPlus/><input'],
  ['aria-expanded={emojiOpen} onClick={()=>setEmojiOpen(value=>!value)}>☺</button>','aria-expanded={emojiOpen} onClick={()=>setEmojiOpen(value=>!value)}><FiSmile/></button>'],
  ['onClick={()=>void toggleVoiceRecording()}>{recording?"■":"🎙"}</button>','onClick={()=>void toggleVoiceRecording()}>{recording?<FiX/>:<FiMic/>}</button>'],
  ['className="social-close" onClick={onClose} aria-label="Close social">×</button>','className="social-close" onClick={onClose} aria-label="Close social"><FiX/></button>'],
];
for(const [before,after] of replacements){if(!source.includes(before))throw new Error(`Target not found: ${before}`);source=source.replace(before,after);}
fs.writeFileSync(path,source);
