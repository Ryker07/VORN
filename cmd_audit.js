const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
    fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            getFiles(filePath, files);
        } else if (file.endsWith('.js')) {
            files.push(filePath);
        }
    });
    return files;
}

const commandFiles = getFiles(path.join(__dirname, 'src', 'commands'));
const result = [];

for (const file of commandFiles) {
    try {
        const req = require(file);
        if (req && req.data && req.data.name) {
            const data = req.data;
            const subs = [];
            if (data.options) {
                for (const opt of data.options) {
                    // Type 1 = Subcommand, Type 2 = SubcommandGroup
                    if (opt.type === 1 || opt.type === 2) {
                        subs.push(opt.name);
                    }
                }
            }
            result.push({
                file: path.relative(__dirname, file),
                name: data.name,
                description: data.description,
                subcommands: subs
            });
        }
    } catch (e) {
        console.error(`Error loading ${file}:`, e.message);
    }
}

fs.writeFileSync('command_audit.json', JSON.stringify(result, null, 2));
console.log('Audit complete.');
