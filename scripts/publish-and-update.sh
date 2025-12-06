#!/bin/bash

# Script to publish the package and update all projects

PACKAGE_DIR="/Users/saif/StudioProjects/teacher_folder/custom_web_desktop_package"
TEACHER_DIR="/Users/saif/StudioProjects/teacher_folder"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Publishing @nexwave/custom_web_desktop_package${NC}"
echo ""

# Step 1: Build the package
echo -e "${YELLOW}📦 Building package...${NC}"
cd "$PACKAGE_DIR"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"
echo ""

# Step 2: Publish (uncomment the method you want to use)
echo -e "${YELLOW}📤 Publishing to npm...${NC}"

# Option A: Publish to npm (public)
# npm publish --access public

# Option B: Publish to GitHub Packages
# npm publish --registry=https://npm.pkg.github.com

echo -e "${YELLOW}⚠️  Publishing is commented out. Uncomment the desired method in the script.${NC}"
echo ""

# Step 3: Update all projects that use the package
echo -e "${YELLOW}🔄 Updating projects...${NC}"

# List of projects to update (add more as needed)
PROJECTS=(
    "tamer_shaaban/tamer_shaaban_web_desktop"
    "jaber_alaa/jaber_alaa_web_desktop"
    # Add more projects here
)

for project in "${PROJECTS[@]}"; do
    PROJECT_PATH="$TEACHER_DIR/$project"
    
    if [ -d "$PROJECT_PATH" ]; then
        echo -e "  Updating: ${project}..."
        cd "$PROJECT_PATH"
        
        # Check if package is installed
        if grep -q "@nexwave/custom_web_desktop_package" package.json 2>/dev/null; then
            npm update @nexwave/custom_web_desktop_package
            echo -e "  ${GREEN}✅ Updated${NC}"
        else
            echo -e "  ${YELLOW}⚠️  Package not installed in this project${NC}"
        fi
    else
        echo -e "  ${RED}❌ Project not found: $project${NC}"
    fi
done

echo ""
echo -e "${GREEN}🎉 Done!${NC}"
