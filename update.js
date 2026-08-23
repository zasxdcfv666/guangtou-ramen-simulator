const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 替换地址
html = html.replace(/菖蒲路5号/g, '朝阳路138号');

// 替换旧的base64图片为新的
const newBase64 = fs.readFileSync('real_store_base64.txt', 'utf8');
const newDataUri = 'data:image/jpeg;base64,' + newBase64;
const oldCount = (html.match(/data:image\/jpeg;base64,/g) || []).length;
html = html.replace(/data:image\/jpeg;base64,[^"')\s]+/g, newDataUri);

fs.writeFileSync('index.html', html);
console.log('Address replaced');
console.log('Images replaced:', oldCount);
console.log('File size KB:', (html.length / 1024).toFixed(1));
