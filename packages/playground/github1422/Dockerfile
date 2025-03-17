FROM mcr.microsoft.com/dotnet/sdk:8.0
RUN apt update && apt install -y faketime
WORKDIR /app
COPY . .
RUN dotnet restore
RUN dotnet build    
CMD faketime "-7min" dotnet run
# docker build -t  dotnet-opcua-server-faketime .
# docker run -it -p 4840:4840 dotnet-opcua-server-faketime


