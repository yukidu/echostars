export function shareMetadata(html: string, track: {title:string;speaker?:string;speakerAvatar?:string}, origin:string, id:string) {
  const escape=(value:string)=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const url = origin + '/share/' + encodeURIComponent(id);
  let image = origin + '/icon-512.png';
  try { const parsed=new URL(track.speakerAvatar||'',origin); if(['https:','http:'].includes(parsed.protocol)) image=parsed.href; } catch {}
  const title=escape(track.title), description=escape((track.speaker||'')+' · 繁星回聲');
  return html.replace(/<meta[^>]+(?:property|name)=["'](?:og:[^"']+|twitter:[^"']+)["'][^>]*>/gi,'')
    .replace(/<title>[\s\S]*?<\/title>/i,'<title>'+title+'｜繁星回聲</title>')
    .replace('</head>',`<meta property="og:type" content="music.song"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:image" content="${escape(image)}"><meta property="og:url" content="${escape(url)}"><meta name="twitter:card" content="summary_large_image"></head>`);
}
