$(document).ready(() => {
  $("#onboard-devices-btn").on("click", (e) => {
    const uploadUrl = "http://localhost:9467/api/devices/onboard-file";
    e.preventDefault();

    const uploadFile = $("#onboardDevicesFile")[0];
    if (uploadFile.files.length === 0) {
      alert("Please select a file.");
      return;
    }

    if (uploadFile.files.length != 0) {
      const formData = new FormData();
      formData.append("file", fileInput.files[0]);
      $.ajax({
        url: uploadUrl,
        type: "POST",
        data: formData,
        processData: false,
        contentType: false,
        success: function (response) {
          console.log(response);
          alert("Onboard File Queued");
        },
        error: function (xhr) {
          console.error(xhr);
        },
      });
    }
  });

  const onboadDevices = (data) => {
    if (!data || data.length === 0) {
      // No data to onboard
      return;
    }

    let deviceData = [];
    data.forEach((device) => {
      var newDevice = {
        customerReference: device.CUSTOMER_REFERENCE,
        imeiNumber: device.IMEI_NUMBER,
        latitude: device.LATITUDE,
        longitude: device.LONGITITUDE,
        mqttUniqueTopic: device.MQTT_TOPIC,
        onlineStatus: device.ONLINE_STATUS,
        serialNumber: device.SERIAL_NUMBER,
        serviceStatus: device.SERVICE_STATUS,
      };
      deviceData.push(newDevice);
    });

    data = deviceData;

    const onboardUrl = "http://localhost:9467/api/devices/onboard-file";
    $.ajax({
      url: onboardUrl,
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
      },
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify(data),
      success: (response) => {
        if (response.statusCode !== "00") {
          alert(response.statusMessage);
        }
      },
      error: function (xhr) {
        alert("Error Onboarding Devices: " + xhr.responseText);
      },
    });
  };

  var ExcelToJSON = function () {
    this.parseExcel = (file) => {
      if (!file) {
        alert("Please select a valid data file.");
        return;
      }
      var reader = new FileReader();

      reader.onload = function (e) {
        var data = e.target.result;
        var workbook = XLSX.read(data, {
          type: "binary",
        });
        workbook.SheetNames.forEach(function (sheetName) {
          var XL_row_object = XLSX.utils.sheet_to_row_object_array(
            workbook.Sheets[sheetName]
          );
          var json_object = JSON.stringify(XL_row_object);
          onboadDevices(JSON.parse(json_object));
        });
      };
      reader.onerror = function (ex) {
        console.log(ex);
      };
      reader.readAsBinaryString(file);
    };
  };

  function selectExcelFile(event) {
    var files = event.target.files;
    var xl2json = new ExcelToJSON();
    xl2json.parseExcel(files[0]);
  }

  $("#onboardDevices").on("change", selectExcelFile);
});
