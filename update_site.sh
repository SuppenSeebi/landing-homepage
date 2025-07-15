#!/bin/bash

cd /var/www/html || exit
echo "Pulling latest changes..."
git pull origin main
echo "Deployment completed."
