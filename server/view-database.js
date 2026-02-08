// Script to view database contents
// Run with: node view-database.js

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function viewDatabase() {
    const SQL = await initSqlJs();
    const dbPath = path.join(__dirname, 'database.sqlite');

    if (!fs.existsSync(dbPath)) {
        console.log('❌ Database file not found at:', dbPath);
        console.log('   The database will be created when you first register a user.');
        return;
    }

    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);

    console.log('\n========================================');
    console.log('       GPS GUARDIAN DATABASE VIEWER');
    console.log('========================================\n');

    // List all tables
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    if (tables.length > 0) {
        console.log('📋 TABLES:');
        tables[0].values.forEach(([name]) => {
            console.log(`   - ${name}`);
        });
        console.log('');
    }

    // View Users
    console.log('👥 USERS:');
    console.log('-'.repeat(60));
    try {
        const users = db.exec("SELECT id, name, email, created_at FROM users");
        if (users.length > 0 && users[0].values.length > 0) {
            console.log('| ID | Name | Email | Created At |');
            console.log('|' + '-'.repeat(58) + '|');
            users[0].values.forEach(([id, name, email, created]) => {
                console.log(`| ${id} | ${name} | ${email} | ${created} |`);
            });
        } else {
            console.log('   (No users registered yet)');
        }
    } catch (e) {
        console.log('   (Table not found or empty)');
    }
    console.log('');

    // View Zones
    console.log('🛡️ SAFE ZONES:');
    console.log('-'.repeat(60));
    try {
        const zones = db.exec("SELECT id, user_id, name, lat, lng, radius, color, active FROM zones");
        if (zones.length > 0 && zones[0].values.length > 0) {
            zones[0].values.forEach(([id, userId, name, lat, lng, radius, color, active]) => {
                console.log(`   Zone #${id}:`);
                console.log(`      User ID: ${userId}`);
                console.log(`      Name: ${name}`);
                console.log(`      Position: ${lat}, ${lng}`);
                console.log(`      Radius: ${radius}m`);
                console.log(`      Color: ${color}`);
                console.log(`      Active: ${active ? 'Yes' : 'No'}`);
                console.log('');
            });
        } else {
            console.log('   (No zones created yet)');
        }
    } catch (e) {
        console.log('   (Table not found or empty)');
    }
    console.log('');

    // View Routes
    console.log('🛣️ ROUTES:');
    console.log('-'.repeat(60));
    try {
        const routes = db.exec("SELECT id, user_id, points, confirmed FROM routes");
        if (routes.length > 0 && routes[0].values.length > 0) {
            routes[0].values.forEach(([id, userId, points, confirmed]) => {
                const parsedPoints = JSON.parse(points || '[]');
                console.log(`   Route #${id}:`);
                console.log(`      User ID: ${userId}`);
                console.log(`      Points: ${parsedPoints.length} waypoints`);
                console.log(`      Confirmed: ${confirmed ? 'Yes' : 'No'}`);
                if (parsedPoints.length > 0) {
                    console.log(`      First point: ${parsedPoints[0].lat}, ${parsedPoints[0].lng}`);
                }
                console.log('');
            });
        } else {
            console.log('   (No routes created yet)');
        }
    } catch (e) {
        console.log('   (Table not found or empty)');
    }
    console.log('');

    // View Settings
    console.log('⚙️ USER SETTINGS:');
    console.log('-'.repeat(60));
    try {
        const settings = db.exec("SELECT id, user_id, esp_ip, recipient_email, dark_mode, auto_center, buffer_radius FROM settings");
        if (settings.length > 0 && settings[0].values.length > 0) {
            settings[0].values.forEach(([id, userId, espIp, recipientEmail, darkMode, autoCenter, bufferRadius]) => {
                console.log(`   Settings #${id}:`);
                console.log(`      User ID: ${userId}`);
                console.log(`      ESP32 IP: ${espIp}`);
                console.log(`      Email: ${recipientEmail}`);
                console.log(`      Dark Mode: ${darkMode ? 'On' : 'Off'}`);
                console.log(`      Auto Center: ${autoCenter ? 'On' : 'Off'}`);
                console.log(`      Buffer Radius: ${bufferRadius}m`);
                console.log('');
            });
        } else {
            console.log('   (No settings saved yet)');
        }
    } catch (e) {
        console.log('   (Table not found or empty)');
    }

    console.log('\n========================================');
    console.log('         END OF DATABASE VIEW');
    console.log('========================================\n');

    db.close();
}

viewDatabase().catch(console.error);
