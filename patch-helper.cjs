let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { data += chunk; if (data.includes('__END_PATCH__')) { data = data.replace('__END_PATCH__', ''); require('child_process').spawnSync('C:/Users/musfi/.vscode/extensions/openai.chatgpt-26.825.51511-win32-x64/bin/windows-x86_64/codex.exe', ['--codex-run-as-apply-patch', data.trimEnd()], { stdio: 'inherit' }); process.exit(); } });
