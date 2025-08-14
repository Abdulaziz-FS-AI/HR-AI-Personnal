#!/bin/bash
cd /home/site/wwwroot
npm install --production
npm run build
npm start