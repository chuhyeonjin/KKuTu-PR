echo "Please wait... This may take several minutes."
yarn
echo "Completed."
echo yarn start > run.bat
cd ./packages/web/
yarn run pack