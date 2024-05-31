# Use an official Node.js runtime as a parent image
FROM --platform=linux/amd64 node:20



# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Install Playwright dependencies and browsers
RUN npx playwright install --with-deps

# Copy the rest of the application code
COPY . .

# Build the Next.js app
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

# Define the command to run the app
CMD ["npm", "start"]
