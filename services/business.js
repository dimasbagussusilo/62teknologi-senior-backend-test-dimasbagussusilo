const {Op} = require("sequelize");
const {Business, BusinessCategory, BusinessCoordinate, BusinessLocation, sequelize} = require('../models');

module.exports = {
    findOne: async (options) => {
        try {
            const business = await Business.findOne({
                where: options,
            });
            return business;
        } catch (errors) {
            return errors
        }
    },

    findAll: async (options) => {
        try {
            const {limit, offset, price, categories, coordinates, location, radius} = options;
            delete options.limit
            delete options.offset
            delete options.categories
            delete options.location
            delete options.coordinates
            delete options.radius

            if (price) {
                options.price = {
                    [Op.in]: price.split(",").map(p => {
                        return '$'.repeat(+p)
                    })
                }
            } else {
                delete options.price
            }

            const categoryOptions = {}
            if (categories) {
                categoryOptions.alias = {
                    [Op.in]: categories.split(',').map(category => {
                        return category
                    })
                }
            }

            const locationOptions = {}
            if (location) {
                locationOptions.display_address = location
            }

            let coordinateOptions = {}
            if (coordinates) {
                coordinateOptions = {
                    latitude: coordinates.latitude, longitude: coordinates.longitude,
                }
            }

            let topFiveCoordinatesByRadius;
            if (radius) {
                const latitude = 41.7873382568359;
                const longitude = -123.051551818848;

                const haversine = `(
                    6371 * acos(
                        cos(radians(${latitude}))
                        * cos(radians(latitude))
                        * cos(radians(longitude) - radians(${longitude}))
                        + sin(radians(${latitude})) * sin(radians(latitude))
                    )
                )`;
                topFiveCoordinatesByRadius = JSON.parse(JSON.stringify(await BusinessCoordinate.findAll({
                    attributes: ['business_id', [sequelize.literal(haversine), 'distance'],],
                    order: sequelize.col('distance'),
                    limit: 5
                })));

                coordinateOptions = {
                    business_id: {[Op.in]: topFiveCoordinatesByRadius.map(coord => coord.business_id)}
                }
            }

            let businesses = await Business.findAndCountAll({
                where: options, limit, offset, include: [{
                    model: BusinessCategory,
                    as: "categories",
                    attributes: ["alias", "title"],
                    where: categoryOptions
                }, {
                    model: BusinessCoordinate,
                    as: "coordinates",
                    attributes: ["latitude", "longitude"],
                    where: coordinateOptions
                }, {
                    model: BusinessLocation,
                    as: "location",
                    attributes: ["address1", "address2", "address3", "city", "country", "display_address", "state", "zip_code", "cross_streets",],
                    where: locationOptions
                }],
                distinct: true
            });

            if (topFiveCoordinatesByRadius) {
                businesses = JSON.parse(JSON.stringify(businesses)).map(business => {
                    return {
                        ...business,
                        distance: topFiveCoordinatesByRadius.filter(coord => coord.business_id === business.id)[0].distance
                    }
                }).sort((a, b) => a.distance - b.distance)
            }

            return businesses;
        } catch (errors) {
            console.log(errors)
            return errors
        }
    },

    create: async (payload, transaction) => {
        await Business.create(payload, {
            transaction
        });
    },

    update: async (payload, options, transaction) => {
        await Business.update(payload, {
            where: options, transaction,
        });
    },

    destroy: async (options, transaction) => {
        await Business.destroy({
            where: options, transaction,
        });
    },
}